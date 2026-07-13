package com.bestra.chat

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.content.pm.PackageManager
import com.lynx.tasm.LynxView
import com.lynx.tasm.LynxViewBuilder
import com.lynx.xelement.XElementBehaviors
import com.lynx.tasm.LynxEnv

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val lynxView: LynxView = buildLynxView()
        setContentView(lynxView)

        val uri = "main.lynx.bundle";
        lynxView.renderTemplateUrl(uri, "")
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == BestraNativeModule.GALLERY_REQUEST_CODE && resultCode == RESULT_OK) {
            // Use the static instance of the module
            BestraNativeModule.instance?.onImagePicked(data?.data)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            BestraNativeModule.PERMISSION_REQUEST_CODE,
            BestraNativeModule.LOCATION_PERMISSION_REQUEST_CODE,
            BestraNativeModule.RECORD_PERMISSION_REQUEST_CODE -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    android.util.Log.d("Bestra", "Permission granted for code: $requestCode")
                    BestraNativeModule.instance?.showToast("Permission granted! Please try again.")
                } else {
                    android.util.Log.d("Bestra", "Permission denied for code: $requestCode")
                    BestraNativeModule.instance?.showToast("Permission denied.")
                }
            }
        }
    }

    private fun buildLynxView(): LynxView {
        val viewBuilder: LynxViewBuilder = LynxViewBuilder()
        viewBuilder.addBehaviors(XElementBehaviors().create())
        viewBuilder.setTemplateProvider(DemoTemplateProvider(this))
        // Explicitly register the module with the view builder as well
        viewBuilder.registerModule("BestraNative", BestraNativeModule::class.java)
        return viewBuilder.build(this)
    }
}
