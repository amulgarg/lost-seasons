exports.handler = async function(event, context) {
    // Enable CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: ''
      };
    }
  
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: 'Method Not Allowed'
      };
    }
  
    try {
      const dialogue = JSON.parse(event.body).dialogue;
      const lines = dialogue.split('\n');
      const dialogueArray = lines.map(line => {
        const [speaker, ...textParts] = line.split(': ');
        return {
          text: textParts.join(': '),
          speaker: speaker
        };
      });
  
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ dialogueArray })
      };
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid input' })
      };
    }
  }