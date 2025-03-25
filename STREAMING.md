# Streaming Response Standardization

This document provides detailed information about using the streaming response feature of the Ollama Bridge Extension.

## Overview

The Ollama Bridge Extension's streaming response standardization enables real-time, token-by-token delivery of text from the Ollama language model to your web application. This feature addresses the challenge of handling different streaming formats across frameworks by providing a consistent interface that works with various client implementations.

## Supported Streaming Formats

The extension supports three main streaming formats:

### 1. Server-Sent Events (SSE)

SSE is the most widely supported streaming format for web applications and provides a clean interface for event-based data delivery.

**Format Structure:**
```
id: 1
data: {"delta":{"content":"Hello"}}

id: 2
data: {"delta":{"content":" world"}}
```

**Ideal for:**
- Frontend frameworks with built-in SSE support
- Applications using EventSource API
- Frameworks like Next.js, React with SSE libraries

### 2. JSON Chunks

Delivers each response chunk as a separate JSON object, ideal for applications that need structured data.

**Format Structure:**
```json
{"delta":{"content":"Hello"}}
{"delta":{"content":" world"}}
```

**Ideal for:**
- Applications that need to process structured data
- Custom stream handling implementations
- Integration with frameworks that expect JSON objects

### 3. Raw Text

Provides plain text content with minimal formatting overhead, maximizing delivery efficiency.

**Format Structure:**
```
Hello world
```

**Ideal for:**
- Simple UI updates where only content is needed
- Minimizing bandwidth and processing overhead
- Applications with custom text processors

## Client-Side APIs

The extension offers three different APIs for consuming streaming responses:

### 1. Callback-Based API

```javascript
const controller = OllamaBridge.requestStream('/api/chat', {
  model: 'llama3',
  messages: [{ role: 'user', content: 'Tell me a story' }]
}, (chunk, done, error) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (done) {
    console.log('Stream completed');
    return;
  }
  
  console.log('Received chunk:', chunk);
  // Add to UI...
}, { streamFormat: 'sse' });

// Optionally abort the stream
// controller.abort();
```

### 2. ReadableStream API

```javascript
const stream = OllamaBridge.getStream('/api/chat', {
  model: 'llama3',
  messages: [{ role: 'user', content: 'Tell me a story' }]
}, { streamFormat: 'json' });

// Process with standard ReadableStream methods
const reader = stream.getReader();

async function processStream() {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // For JSON format, parse the value
    const parsedChunk = JSON.parse(value);
    console.log('Content:', parsedChunk.delta?.content);
    
    // Add to UI...
  }
  
  console.log('Stream complete');
}

processStream().catch(console.error);
```

### 3. EventTarget API

```javascript
const eventSource = OllamaBridge.getEventSource('/api/chat', {
  model: 'llama3',
  messages: [{ role: 'user', content: 'Tell me a story' }]
}, { streamFormat: 'sse' });

eventSource.addEventListener('chunk', (event) => {
  console.log('Received chunk:', event.detail);
  // Add to UI...
});

eventSource.addEventListener('end', () => {
  console.log('Stream completed');
});

eventSource.addEventListener('error', (event) => {
  console.error('Stream error:', event.detail);
});

// Optionally abort the stream
// eventSource.abort();
```

## Stream Transformation Templates

The extension includes pre-configured templates for popular frameworks:

### Default Ollama Format

Maintains Ollama's native format with minimal transformation.

```javascript
// Stream response example for chat API
{
  "model": "llama3",
  "message": {
    "role": "assistant",
    "content": "Hello"
  }
}
```

### Next.js + LangChain Format

Compatible with Next.js applications using LangChain.js.

```javascript
// Stream response format
{
  "token": {
    "text": "Hello"
  },
  "messageId": "msg_1234567890",
  "conversationId": "conv_1234567890"
}
```

### OpenAI API Format

Follows the OpenAI API streaming format for drop-in compatibility.

```javascript
// Stream chunk format
{
  "id": "chatcmpl-1234567890",
  "object": "chat.completion.chunk",
  "created": 1677858242,
  "model": "llama3",
  "choices": [
    {
      "index": 0,
      "delta": {
        "content": "Hello"
      },
      "finish_reason": null
    }
  ]
}
```

### SSE-Compatible Format

Simplified format optimized for Server-Sent Events clients.

```javascript
// Stream chunk format
{
  "text": "Hello",
  "done": false
}
```

## Creating Custom Templates

You can create custom transformation templates for your specific application needs:

```javascript
// Add to background.js or through extension configuration
const MY_CUSTOM_TEMPLATE = {
  id: 'my-custom-template',
  name: 'My Custom Template',
  description: 'Custom format for my application',
  framework: 'custom',
  
  // Request transformation
  streamRequestTransform: {
    '/api/chat': (data) => {
      return {
        model: data.model || 'defaultModel',
        messages: data.messages || [
          { role: 'user', content: data.prompt || 'Hello' }
        ],
        stream: true // Always ensure streaming is enabled
      };
    }
  },
  
  // Response transformation
  streamResponseTransform: {
    '/api/chat': (chunk) => {
      // Extract content from chunk
      let content = '';
      if (chunk.message && chunk.message.content) {
        content = chunk.message.content;
      } else if (chunk.delta && chunk.delta.content) {
        content = chunk.delta.content;
      }
      
      // Return your custom format
      return {
        text: content,
        timestamp: Date.now(),
        custom_field: 'custom value'
      };
    }
  }
};
```

## Extension Configuration

The extension provides a configuration UI for streaming settings in the extension popup:

### Streaming Tab Settings

1. **Enable Streaming Responses**: Toggle to enable/disable streaming globally
2. **Default Stream Format**: Select the default format (SSE, JSON, or Text)
3. **Buffer Size**: Configure the buffer size for text streaming (lower values send smaller chunks more frequently)
4. **Response Template**: Select the transformation template for streaming responses

## Performance Optimization

For optimal streaming performance:

1. **Choose the Right Format**:
   - Use 'text' format for minimal overhead
   - Use 'json' for structured data processing
   - Use 'sse' for frameworks with native SSE support

2. **Buffer Size Tuning**:
   - Lower values (10-30): More responsive, higher overhead
   - Higher values (50-100): More efficient, slight latency

3. **Error Handling**:
   - Always implement error listeners/handlers
   - Provide graceful fallbacks for stream interruptions

## Browser Compatibility

The streaming feature is compatible with all modern browsers that support:

- Fetch API with ReadableStream
- EventTarget interface
- TextDecoder API

Minimum browser versions:
- Chrome 43+
- Firefox 65+
- Safari 10.1+
- Edge 79+

## Troubleshooting

Common issues and solutions:

### No Streaming Response

1. Verify streaming is enabled in the extension popup
2. Ensure the Ollama server is running with streaming support
3. Check that the model supports streaming

### Streaming Stops Unexpectedly

1. Check for console errors related to stream processing
2. Verify the client has proper error handling
3. Ensure network connection remains stable

### High Latency

1. Adjust buffer size to a higher value
2. Use 'text' format for minimal processing overhead
3. Simplify client-side stream processing logic

## Examples

### React Example

```jsx
import React, { useState, useEffect, useRef } from 'react';

function OllamaChat() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef(null);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Clear previous response
    setResponse('');
    setLoading(true);
    
    // Abort previous stream if exists
    if (eventSourceRef.current) {
      eventSourceRef.current.abort();
    }
    
    // Create new stream
    eventSourceRef.current = window.OllamaBridge.getEventSource('/api/chat', {
      model: 'llama3',
      messages: [{ role: 'user', content: input }]
    });
    
    // Handle stream events
    eventSourceRef.current.addEventListener('chunk', (event) => {
      const chunk = event.detail;
      const content = chunk.delta?.content || chunk.message?.content || '';
      setResponse(prev => prev + content);
    });
    
    eventSourceRef.current.addEventListener('end', () => {
      setLoading(false);
      eventSourceRef.current = null;
    });
    
    eventSourceRef.current.addEventListener('error', (event) => {
      console.error('Stream error:', event.detail);
      setLoading(false);
      eventSourceRef.current = null;
    });
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.abort();
      }
    };
  }, []);
  
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Send'}
        </button>
      </form>
      
      <div className="response">
        {response || (loading ? 'Thinking...' : '')}
      </div>
    </div>
  );
}
```

### Vue Example

```vue
<template>
  <div>
    <form @submit.prevent="handleSubmit">
      <input
        v-model="input"
        placeholder="Ask anything..."
      />
      <button type="submit" :disabled="loading">
        {{ loading ? 'Generating...' : 'Send' }}
      </button>
    </form>
    
    <div class="response">
      {{ response || (loading ? 'Thinking...' : '') }}
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      input: '',
      response: '',
      loading: false,
      eventSource: null
    };
  },
  methods: {
    handleSubmit() {
      // Clear previous response
      this.response = '';
      this.loading = true;
      
      // Abort previous stream if exists
      if (this.eventSource) {
        this.eventSource.abort();
      }
      
      // Create new stream
      this.eventSource = window.OllamaBridge.getEventSource('/api/chat', {
        model: 'llama3',
        messages: [{ role: 'user', content: this.input }]
      });
      
      // Handle stream events
      this.eventSource.addEventListener('chunk', (event) => {
        const chunk = event.detail;
        const content = chunk.delta?.content || chunk.message?.content || '';
        this.response += content;
      });
      
      this.eventSource.addEventListener('end', () => {
        this.loading = false;
        this.eventSource = null;
      });
      
      this.eventSource.addEventListener('error', (event) => {
        console.error('Stream error:', event.detail);
        this.loading = false;
        this.eventSource = null;
      });
    }
  },
  beforeDestroy() {
    // Clean up on unmount
    if (this.eventSource) {
      this.eventSource.abort();
    }
  }
};
</script>
```

## Compatibility With Ollama APIs

The streaming implementation is compatible with all Ollama streaming endpoints:

1. **Chat API** (`/api/chat`)
   - Streaming occurs on a per-token basis
   - Each message content is streamed incrementally

2. **Generate API** (`/api/generate`)
   - Response is streamed token by token
   - Compatible with older Ollama versions

Each API automatically gets the correct format and transformations applied based on the selected template and format. 