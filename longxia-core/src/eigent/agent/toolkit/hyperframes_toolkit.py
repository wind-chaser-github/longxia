"""
HyperFrames Rendering Toolkit

This toolkit provides the local rendering pipeline for HyperFrames.
It allows Longxia agents (like Creative and UIUX agents) to dispatch an HTML file 
(typically built with CSS and GSAP animations) and programmatically render it 
into a highly-polished MP4 video format using headless Playwright and FFmpeg.
"""

import os
import asyncio
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class HyperFramesToolkit:
    """
    Toolkit for rendering dynamic HTML animations (Seedance 2.0 & HyperFrames specs) into MP4 videos.
    Requires `playwright` and `ffmpeg` to be installed in the local environment.
    """
    
    def __init__(self, output_dir: str = "./outputs/hyperframes"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
    async def render_html_to_mp4(self, html_file_path: str, duration_sec: int = 15, fps: int = 60) -> Dict[str, Any]:
        """
        Dispatches the HyperFrames pipeline to render an HTML file into an MP4 video.
        
        Args:
            html_file_path: Absolute or relative path to the source HTML file containing GSAP animations.
            duration_sec: Recording duration in seconds (default is 15s for Seedance 2.0).
            fps: Frames per second for smooth motion graphics.
            
        Returns:
            Dict containing the output video path and rendering status.
        """
        if not os.path.exists(html_file_path):
            return {"error": f"HTML file not found at {html_file_path}"}
            
        output_filename = f"hyperframe_render_{os.path.basename(html_file_path)}.mp4"
        output_path = os.path.join(self.output_dir, output_filename)
        
        logger.info(f"[hyperframes_dispatch] 调度 HyperFrames 动效管线: {html_file_path} -> {output_path}")
        
        try:
            # Note: The actual playwright rendering logic requires playwright context.
            # This is a robust skeleton implementation for the agent dispatch toolkit.
            from playwright.async_api import async_playwright
            import ffmpeg
            
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(
                    record_video_dir=self.output_dir,
                    record_video_size={"width": 1920, "height": 1080}
                )
                
                # Navigate to local file and wait for rendering
                await page.goto(f"file://{os.path.abspath(html_file_path)}")
                
                # Simulate playback duration to capture video
                logger.info(f"Recording GSAP animations for {duration_sec} seconds at {fps} fps...")
                await asyncio.sleep(duration_sec)
                
                # Fetch the internally saved WebM video path from playwright
                raw_video_path = await page.video.path()
                await browser.close()
                
                # Post-process with FFmpeg: Convert WebM to MP4 with High Quality
                logger.info("Transcoding raw capture to High-Quality MP4 via FFmpeg...")
                (
                    ffmpeg
                    .input(raw_video_path)
                    .output(output_path, vcodec='libx264', pix_fmt='yuv420p', r=fps)
                    .overwrite_output()
                    .run(quiet=True)
                )
                
                # Cleanup raw playwright webm file
                if os.path.exists(raw_video_path):
                    os.remove(raw_video_path)
                    
            return {
                "status": "success",
                "video_path": output_path,
                "duration": duration_sec,
                "message": "HyperFrames rendering completed successfully."
            }
            
        except Exception as e:
            logger.error(f"HyperFrames rendering pipeline failed: {e}")
            return {"error": str(e), "status": "failed"}

    async def get_supported_specs(self) -> Dict[str, Any]:
        """Returns the supported animation specifications."""
        return {
            "HyperFrames": "Dynamic Graphics Pipeline (HTML to MP4)",
            "Seedance_2.0": "15s Cinematic Short-form Guidelines",
            "Supported_Animations": ["GSAP", "CSS3 Transitions", "Canvas"]
        }
