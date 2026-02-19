#!/usr/bin/env node

import { exec } from 'openclaw-plugin-sdk';

async function transcribeAudio({ audio_path, language = 'en', model = 'tiny' }) {
  // Check if Whisper is installed
  try {
    await exec(`whisper --version`);
  } catch (error) {
    // Whisper not found, guide user to install
    return {
      success: false,
      error: `Whisper is not installed. Please install it first:\n1. Install Python: https://www.python.org/downloads/\n2. Install Whisper: pip install openai-whisper\n3. Or install whisper.cpp: https://github.com/ggerganov/whisper.cpp`
    };
  }

  // Validate audio file exists
  try {
    await exec(`test -f "${audio_path}" && echo "file_exists"`);
  } catch (error) {
    return {
      success: false,
      error: `Audio file not found: ${audio_path}`
    };
  }

  // Run Whisper transcription
  try {
    const { stdout } = await exec(
      `whisper "${audio_path}" --model ${model} --language ${language} --output_format txt`
    );
    
    // Clean up the transcript
    const transcript = stdout.trim().replace(/^\s*\n\s*|\s*\n\s*$/g, '');
    
    return {
      success: true,
      transcript: transcript
    };
  } catch (error) {
    return {
      success: false,
      error: `Transcription failed: ${error.message}`
    };
  }
}

export default transcribeAudio;

// Export for testing
export { transcribeAudio };