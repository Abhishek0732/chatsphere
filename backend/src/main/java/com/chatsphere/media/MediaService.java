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

import java.io.InputStream;
import java.util.UUID;

@Service
public class MediaService {

    private static final Logger log = LoggerFactory.getLogger(MediaService.class);

    public record UploadResult(String url, String fileName, String contentType, long size) {}

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
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("No file provided");
        }
        String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String safe = original.replaceAll("[^a-zA-Z0-9._-]", "_");
        String objectKey = "uploads/" + UUID.randomUUID() + "-" + safe;
        String contentType = file.getContentType() == null
                ? "application/octet-stream" : file.getContentType();

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

        // Return a relative, same-origin URL. The frontend nginx proxies
        // "/media/<bucket>/<object>" to MinIO, so media loads correctly over
        // localhost, a LAN IP, or an HTTPS tunnel without a baked-in host.
        String url = "/media/" + config.bucket() + "/" + objectKey;
        return new UploadResult(url, original, contentType, file.getSize());
    }
}
