package com.chatsphere.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WebView.setWebContentsDebuggingEnabled(true)
        setContent {
            MaterialTheme(colorScheme = androidx.compose.material3.darkColorScheme()) {
                Surface(color = Color(0xFF0B0C14)) {
                    WebViewApp(url = getString(R.string.app_url))
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewApp(url: String) {
    val context = LocalContext.current
    val webViewRef = remember { mutableStateOf<WebView?>(null) }
    val canGoBack = remember { mutableStateOf(false) }
    val filePathCallback = remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

    // input type=file support
    val fileChooserLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        filePathCallback.value?.onReceiveValue(uris)
        filePathCallback.value = null
    }

    // Ask for the runtime permissions the web app may use.
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { }
    LaunchedEffect(Unit) {
        val perms = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS,
            Manifest.permission.ACCESS_FINE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissionLauncher.launch(perms.toTypedArray())
    }

    // Hardware back navigates the WebView history first.
    BackHandler(enabled = canGoBack.value) { webViewRef.value?.goBack() }

    AndroidView(
        modifier = Modifier.fillMaxSize().systemBarsPadding(),
        factory = { ctx ->
            WebView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                setBackgroundColor(0xFF0B0C14.toInt())

                with(settings) {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    javaScriptCanOpenWindowsAutomatically = true
                    mediaPlaybackRequiresUserGesture = false
                    allowFileAccess = true
                    allowContentAccess = true
                    loadWithOverviewMode = true
                    useWideViewPort = true
                    cacheMode = WebSettings.LOAD_DEFAULT
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    setSupportZoom(false)
                    builtInZoomControls = false
                    userAgentString = "$userAgentString ChatSphereApp"
                }

                CookieManager.getInstance().setAcceptCookie(true)
                CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

                webChromeClient = object : WebChromeClient() {
                    // Camera / microphone requested by the page — grant it.
                    override fun onPermissionRequest(request: PermissionRequest) {
                        request.grant(request.resources)
                    }

                    override fun onGeolocationPermissionsShowPrompt(
                        origin: String?,
                        callback: GeolocationPermissions.Callback?,
                    ) {
                        callback?.invoke(origin, true, false)
                    }

                    // File picker (input type="file", camera capture).
                    override fun onShowFileChooser(
                        webView: WebView?,
                        callback: ValueCallback<Array<Uri>>?,
                        params: FileChooserParams?,
                    ): Boolean {
                        val intent = params?.createIntent() ?: return false
                        filePathCallback.value?.onReceiveValue(null)
                        filePathCallback.value = callback
                        return try {
                            fileChooserLauncher.launch(intent)
                            true
                        } catch (e: Exception) {
                            filePathCallback.value = null
                            false
                        }
                    }
                }

                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView?,
                        request: WebResourceRequest?,
                    ): Boolean {
                        val target = request?.url ?: return false
                        val scheme = target.scheme ?: return false
                        // Keep http(s) inside the app; hand off tel:/mailto:/intent: to the OS.
                        return if (scheme == "http" || scheme == "https") {
                            false
                        } else {
                            try {
                                context.startActivity(
                                    android.content.Intent(android.content.Intent.ACTION_VIEW, target),
                                )
                            } catch (_: Exception) {
                            }
                            true
                        }
                    }

                    override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
                        canGoBack.value = view?.canGoBack() == true
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        canGoBack.value = view?.canGoBack() == true
                    }
                }

                // Downloads (attachments) -> Android DownloadManager.
                setDownloadListener { downloadUrl, userAgent, contentDisposition, mimeType, _ ->
                    try {
                        val fileName = URLUtil.guessFileName(downloadUrl, contentDisposition, mimeType)
                        val req = DownloadManager.Request(Uri.parse(downloadUrl)).apply {
                            setMimeType(mimeType)
                            addRequestHeader("User-Agent", userAgent)
                            addRequestHeader("Cookie", CookieManager.getInstance().getCookie(downloadUrl))
                            setDescription("Downloading $fileName")
                            setTitle(fileName)
                            setNotificationVisibility(
                                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED,
                            )
                            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                        }
                        val dm = ctx.getSystemService(DownloadManager::class.java)
                        dm.enqueue(req)
                    } catch (_: Exception) {
                    }
                }

                loadUrl(url)
                webViewRef.value = this
            }
        },
    )
}
