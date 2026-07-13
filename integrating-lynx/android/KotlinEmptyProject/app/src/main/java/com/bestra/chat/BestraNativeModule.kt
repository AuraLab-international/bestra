package com.bestra.chat

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.ReadableMap
import com.lynx.tasm.behavior.LynxContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class BestraNativeModule(context: Context) : LynxModule(context) {

    private val mLynxContext: LynxContext = context as LynxContext

    companion object {
        private const val TAG = "BestraNative"
        @JvmStatic
        var instance: BestraNativeModule? = null
        const val GALLERY_REQUEST_CODE = 1001
        const val PERMISSION_REQUEST_CODE = 2001
        const val LOCATION_PERMISSION_REQUEST_CODE = 3001
        const val RECORD_PERMISSION_REQUEST_CODE = 4001
    }

    init {
        instance = this
        Log.d(TAG, "BestraNativeModule init block started")
    }

    private var imageCallback: Callback? = null
    private var locationCallback: Callback? = null
    private var mediaPlayer: MediaPlayer? = null
    private var mediaRecorder: MediaRecorder? = null
    private var audioFile: File? = null

    private fun getActivity(): Activity? {
        Log.d(TAG, "getActivity called")
        var context: Context? = mLynxContext
        while (context is ContextWrapper) {
            if (context is Activity) {
                return context
            }
            context = context.baseContext
        }
        return mLynxContext.activity as? Activity
    }

    @LynxMethod
    fun testNative(params: ReadableMap?, callback: Callback) {
        Log.d(TAG, "testNative called with params: $params")
        showToast("Native Bridge is Working!")
        callback.invoke("success", "Bridge OK")
    }

    @LynxMethod
    fun showToast(message: String) {
        Log.d(TAG, "showToast: $message")
        val context = getActivity() ?: mLynxContext
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }
    }

    @LynxMethod
    fun openGallery(params: ReadableMap?, callback: Callback) {
        Log.d(TAG, "openGallery called")
        val activity = getActivity()
        if (activity == null) {
            Log.e(TAG, "openGallery: Activity is null")
            callback.invoke("error", "Activity not found")
            return
        }
        imageCallback = callback

        val permission = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_IMAGES
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }

        if (ContextCompat.checkSelfPermission(activity, permission) != PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Requesting gallery permission: $permission")
            ActivityCompat.requestPermissions(activity, arrayOf(permission), PERMISSION_REQUEST_CODE)
            callback.invoke("error", "Permission required. Please try again.")
            return
        }

        try {
            val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
            activity.startActivityForResult(intent, GALLERY_REQUEST_CODE)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening gallery", e)
            callback.invoke("error", e.message)
        }
    }

    @LynxMethod
    fun getCurrentLocation(params: ReadableMap?, callback: Callback) {
        Log.d(TAG, "getCurrentLocation called")
        val activity = getActivity()
        if (activity == null) {
            Log.e(TAG, "getCurrentLocation: Activity is null")
            callback.invoke("error", "Activity not found")
            return
        }
        locationCallback = callback

        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Requesting location permission")
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), LOCATION_PERMISSION_REQUEST_CODE)
            callback.invoke("error", "Permission required. Please try again.")
            return
        }

        val locationManager = activity.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
        val isNetworkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

        if (!isGpsEnabled && !isNetworkEnabled) {
            Log.w(TAG, "Location services are disabled")
            callback.invoke("error", "Location services are disabled")
            return
        }

        val provider = if (isNetworkEnabled) LocationManager.NETWORK_PROVIDER else LocationManager.GPS_PROVIDER
        
        try {
            Log.d(TAG, "Fetching last known location")
            val lastGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            val lastNetwork = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            
            // Use the most recent or available location
            val location = when {
                lastGps != null && lastNetwork != null -> if (lastGps.time > lastNetwork.time) lastGps else lastNetwork
                lastGps != null -> lastGps
                else -> lastNetwork
            }

            if (location != null) {
                Log.d(TAG, "Location found: ${location.latitude},${location.longitude}")
                callback.invoke("success", "${location.latitude},${location.longitude}")
            } else {
                Log.d(TAG, "Requesting single location update from $provider")
                locationManager.requestSingleUpdate(provider, object : LocationListener {
                    override fun onLocationChanged(loc: Location) {
                        Log.d(TAG, "Single update received: ${loc.latitude},${loc.longitude}")
                        locationCallback?.invoke("success", "${loc.latitude},${loc.longitude}")
                        locationCallback = null
                    }
                    override fun onStatusChanged(p0: String?, p1: Int, p2: Bundle?) {}
                    override fun onProviderEnabled(p0: String) {}
                    override fun onProviderDisabled(p0: String) {}
                }, Looper.getMainLooper())
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied during location request", e)
            callback.invoke("error", "Permission denied")
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting location", e)
            callback.invoke("error", e.message)
        }
    }

    @LynxMethod
    fun startRecording(params: ReadableMap?, callback: Callback) {
        Log.d(TAG, "startRecording called")
        val activity = getActivity()
        if (activity == null) {
            Log.e(TAG, "startRecording: Activity is null")
            callback.invoke("error", "Activity not found")
            return
        }

        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Requesting audio record permission")
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.RECORD_AUDIO), RECORD_PERMISSION_REQUEST_CODE)
            callback.invoke("error", "Permission required. Please try again.")
            return
        }

        try {
            audioFile = File.createTempFile("bestra_rec", ".m4a", mLynxContext.cacheDir)
            mediaRecorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setOutputFile(audioFile?.absolutePath)
                prepare()
                start()
            }
            Log.d(TAG, "Recording started: ${audioFile?.absolutePath}")
            callback.invoke("success", "Recording started")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting recording", e)
            callback.invoke("error", e.message)
        }
    }

    @LynxMethod
    fun stopRecording(params: ReadableMap?, callback: Callback) {
        Log.d(TAG, "stopRecording called")
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null

            val bytes = audioFile?.readBytes()
            if (bytes != null) {
                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                Log.d(TAG, "Recording stopped, base64 size: ${base64.length}")
                callback.invoke("success", "data:audio/m4a;base64,$base64")
            } else {
                Log.e(TAG, "Failed to read audio file")
                callback.invoke("error", "Failed to read audio file")
            }
            audioFile?.delete()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording", e)
            callback.invoke("error", e.message)
        }
    }

    @LynxMethod
    fun playAudio(base64Data: String) {
        Log.d(TAG, "playAudio called")
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null

            val cleanBase64 = if (base64Data.contains(",")) base64Data.split(",")[1] else base64Data
            val audioBytes = Base64.decode(cleanBase64, Base64.DEFAULT)

            val tempFile = File.createTempFile("bestra_voice", ".m4a", mLynxContext.cacheDir)
            FileOutputStream(tempFile).use { it.write(audioBytes) }

            mediaPlayer = MediaPlayer().apply {
                setDataSource(tempFile.absolutePath)
                prepare()
                start()
                setOnCompletionListener {
                    it.release()
                    if (mediaPlayer == it) mediaPlayer = null
                    tempFile.delete()
                }
            }
            Log.d(TAG, "Audio playback started")
        } catch (e: Exception) {
            Log.e(TAG, "Error playing audio", e)
        }
    }

    @LynxMethod
    fun openUrl(url: String) {
        Log.d(TAG, "openUrl: $url")
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            mLynxContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening URL: $url", e)
        }
    }

    fun onImagePicked(uri: Uri?) {
        Log.d(TAG, "onImagePicked: $uri")
        if (uri == null) {
            imageCallback?.invoke("error", "No image selected")
            return
        }
        
        try {
            val inputStream: InputStream? = mLynxContext.contentResolver.openInputStream(uri)
            val bytes = inputStream?.readBytes()
            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            Log.d(TAG, "Image picked and encoded, size: ${base64.length}")
            imageCallback?.invoke("success", "data:image/jpeg;base64,$base64")
        } catch (e: Exception) {
            Log.e(TAG, "Error processing picked image", e)
            imageCallback?.invoke("error", e.message)
        }
    }
}
