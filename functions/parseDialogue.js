const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('ffmpeg-static');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

exports.handler = async function(event) {
  // CORS handling
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    // Voice IDs mapping
    const voiceIds = {
      'HARRY': 'CwhRBWXzGAHq8TQ4Fs17',
      'GINNY': '2Ix3Jb9frx7NJI0VhiDp',
      'default': 'CwhRBWXzGAHq8TQ4Fs17'
    };

    // Create persistent directory in Render
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const audioDir = path.join(process.cwd(), 'audio-files', timestamp);
    fs.mkdirSync(audioDir, { recursive: true });

    // Parse dialogue
    const body = JSON.parse(event.body);
    const dialogue = Buffer.from(body.dialogue, 'base64').toString();
    const lines = dialogue.split('\n').filter(line => line.trim());

    // Generate audio for each line
    const audioFiles = [];
    for (let i = 0; i < lines.length; i++) {
      const [speaker, ...textParts] = lines[i].split(': ');
      const text = textParts.join(': ');
      const voiceId = voiceIds[speaker] || voiceIds.default;
      
      const outputFile = path.join(audioDir, `dialogue_${i.toString().padStart(3, '0')}.mp3`);
      
      try {
        const response = await axios({
          method: 'POST',
          url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
          },
          data: {
            text: text,
            model_id: 'eleven_flash_v2_5',
            voice_settings: {
              stability: 0.7,
              similarity_boost: 0.5,
              style: 1,
              use_speaker_boost: true
            }
          },
          responseType: 'arraybuffer'
        });

        fs.writeFileSync(outputFile, response.data);
        audioFiles.push(outputFile);
      } catch (error) {
        console.error(`Error generating audio for line ${i}:`, error.response?.data || error.message);
        throw error;
      }
    }

    // Combine audio files
    const outputFile = path.join(audioDir, 'combined_audio.mp3');
    const fileList = path.join(audioDir, 'files.txt');
    
    const fileContent = audioFiles.map(file => `file '${file}'`).join('\n');
    fs.writeFileSync(fileList, fileContent);

    const ffmpegCommand = `${ffmpeg} -f concat -safe 0 -i ${fileList} -c copy ${outputFile}`;
    await execAsync(ffmpegCommand);

    // Generate public URL
    const publicUrl = `https://${process.env.RENDER_EXTERNAL_URL}/audio-files/${timestamp}/combined_audio.mp3`;

    // Clean up individual files but keep the combined one
    audioFiles.forEach(file => fs.unlinkSync(file));
    fs.unlinkSync(fileList);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        url: publicUrl,
        timestamp: timestamp
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to process audio',
        details: error.message 
      })
    };
  }
};