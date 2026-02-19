# Transcribe Skill for OpenClaw

This skill transcribes WhatsApp voice messages (and other audio files) using local Whisper. It's designed to work with audio files saved from WhatsApp voice notes.

## Installation

1. Ensure Whisper is installed on your system:
   - **Python version**: `pip install openai-whisper`
   - **Or whisper.cpp**: Follow instructions at https://github.com/ggerganov/whisper.cpp

2. Place this skill in your OpenClaw skills directory:
   ```bash
   cp -r skills/transcribe /path/to/openclaw/skills/
   ```

## Usage

### As an Agent

```javascript
// Example agent usage
const transcribe = require('openclaw-plugin-sdk').getTool('transcribe.transcribe_audio');

async function handleWhatsAppVoice(audioPath) {
  const result = await transcribe.transcribe_audio({
    audio_path: audioPath,
    language: 'en',
    model: 'tiny'
  });

  if (result.success) {
    return `Transcription: ${result.transcript}`;
  } else {
    return `Error: ${result.error}`;
  }
}
```

### Direct Tool Call

```bash
# Save WhatsApp voice message as audio file (e.g., voice.opus)
# Then call the tool:
openclaw transcribe.transcribe_audio --audio_path voice.opus
```

## WhatsApp Voice Notes

WhatsApp voice messages are typically saved as `.opus` or `.ogg` files. Here's how to save them:

1. **Android**: Long-press the voice message → "Share" → "Save to Files"
2. **iOS**: Long-press the voice message → "Forward" → "Save to Files"

The skill automatically handles `.opus`, `.ogg`, and other common audio formats.

## Parameters

- `audio_path` (required): Path to the audio file
- `language` (optional): Language code (default: 'en')
- `model` (optional): Whisper model to use (default: 'tiny')

## Supported Models

- `tiny`: Fast, small model (~39MB)
- `base`: Medium model (~74MB)
- `small`: Better quality (~244MB)
- `medium`: High quality (~769MB)

For WhatsApp voice notes, `tiny` is usually sufficient and fastest.

## Error Handling

The skill checks for:
- Whisper installation
- File existence
- Transcription errors

If Whisper is not installed, it provides installation instructions.

## Example Response

```json
{
  "success": true,
  "transcript": "Hey, I just wanted to check in and see how you're doing."
}
```

Or in case of error:

```json
{
  "success": false,
  "error": "Whisper is not installed. Please install it first..."
}
```

## Fallback Option

If local Whisper is not available, the skill can be extended to use web-based APIs like OpenRouter's Whisper model. However, this implementation focuses on local transcription for privacy and speed.

## Requirements

- Node.js 16+ (for OpenClaw)
- Whisper (Python or whisper.cpp)
- Audio file from WhatsApp or other source

## Performance Tips

- Use `tiny` model for quick transcriptions
- Ensure audio files are not corrupted
- For better accuracy, use higher quality audio when possible