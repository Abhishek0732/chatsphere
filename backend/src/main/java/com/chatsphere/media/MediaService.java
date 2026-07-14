package com.chatsphere.media;

import com.chatsphere.common.config.AppProperties;
import com.chatsphere.common.error.ApiException;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.UUID;

@Service
public class MediaService {

    private static final Logger log = LoggerFactory.getLogger(MediaService.class);

    public record UploadResult(String url, String fileName, String contentType, long size,
                               String thumbnailUrl) {}

    /**
     * Longest edge of the generated thumbnail. Chat bubbles are ~288px and grid
     * tiles ~100px, so this covers both at 2x for retina.
     */
    private static final int THUMB_MAX_EDGE = 480;

    /** Thumbnails live beside the original, at a derivable key. */
    static String thumbKey(String objectKey) {
        return objectKey + ".thumb.jpg";
    }

    private final MinioClient minioClient;
    private final AppProperties.Minio config;

    public MediaService(MinioClient minioClient, AppProperties props) {
        this.minioClient = minioClient;
        this.config = props.minio();
    }

    @PostConstruct
    void ensureBucket() {
        try {
            boolean exists = minioClient.bucketExists(
                    BucketExistsArgs.builder().bucket(config.bucket()).build());
            if (!exists) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(config.bucket()).build());
            }
        } catch (Exception e) {
            // The minio-init compose service also creates the bucket; log and continue.
            log.warn("Could not verify/create MinIO bucket '{}': {}", config.bucket(), e.getMessage());
        }
    }

    public UploadResult upload(MultipartFile file) {
        return upload(file, false);
    }

    /**
     * @param encrypted the body is ciphertext the client sealed with a key we do not
     *                  have (an attachment in an end-to-end encrypted chat).
     *
     * Two things change when it is. We do NOT put the original filename in the object
     * key — "salary-2026.pdf" in a URL is a leak all by itself, and the point of
     * encrypting the file is that we learn nothing from it. And we do not attempt a
     * thumbnail: there is no image here to read, only random-looking bytes.
     */
    public UploadResult upload(MultipartFile file, boolean encrypted) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("No file provided");
        }
        String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String safe = original.replaceAll("[^a-zA-Z0-9._-]", "_");
        String objectKey = encrypted
                ? "uploads/" + UUID.randomUUID() + ".enc"
                : "uploads/" + UUID.randomUUID() + "-" + safe;
        String contentType = encrypted
                ? "application/octet-stream"
                : (file.getContentType() == null ? "application/octet-stream" : file.getContentType());

        try (InputStream in = file.getInputStream()) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(config.bucket())
                    .object(objectKey)
                    .stream(in, file.getSize(), -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "Upload failed: " + e.getMessage());
        }

        // A thumbnail, so a 100px grid tile doesn't download a 3MB original. Every
        // member of a group re-downloaded the full-size photo, every time it fell
        // out of browser cache — the single biggest bandwidth cost in the app.
        String thumbUrl = null;
        if (!encrypted && contentType.startsWith("image/") && !contentType.contains("gif")) {
            thumbUrl = writeThumbnail(file, objectKey);
        }

        // Return a relative, same-origin URL. The frontend nginx proxies
        // "/media/<bucket>/<object>" to MinIO, so media loads correctly over
        // localhost, a LAN IP, or an HTTPS tunnel without a baked-in host.
        String url = "/media/" + config.bucket() + "/" + objectKey;
        // For an encrypted upload we hand back nothing identifying: the real filename
        // and type live inside the encrypted message body, which only the two
        // participants can open.
        return new UploadResult(url, encrypted ? "attachment" : original,
                contentType, file.getSize(), thumbUrl);
    }

    /**
     * Scale the image down and store it next to the original. Failure is never
     * fatal: the client falls back to the original, which is what happened for
     * every image uploaded before thumbnails existed.
     */
    private String writeThumbnail(MultipartFile file, String objectKey) {
        try (InputStream in = file.getInputStream()) {
            BufferedImage src = ImageIO.read(in);
            if (src == null) return null;

            int w = src.getWidth();
            int h = src.getHeight();
            double scale = (double) THUMB_MAX_EDGE / Math.max(w, h);
            if (scale >= 1.0) return null; // already small — the original IS the thumb

            int tw = Math.max(1, (int) Math.round(w * scale));
            int th = Math.max(1, (int) Math.round(h * scale));
            BufferedImage thumb = new BufferedImage(tw, th, BufferedImage.TYPE_INT_RGB);
            var g = thumb.createGraphics();
            g.drawImage(src.getScaledInstance(tw, th, Image.SCALE_SMOOTH), 0, 0, null);
            g.dispose();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(thumb, "jpg", out);
            byte[] bytes = out.toByteArray();

            String key = thumbKey(objectKey);
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(config.bucket())
                    .object(key)
                    .stream(new ByteArrayInputStream(bytes), bytes.length, -1)
                    .contentType("image/jpeg")
                    .build());
            return "/media/" + config.bucket() + "/" + key;
        } catch (Exception e) {
            log.warn("Could not generate thumbnail for {}: {}", objectKey, e.toString());
            return null;
        }
    }
}
