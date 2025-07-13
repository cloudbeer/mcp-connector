#!/usr/bin/env python
"""
Test script for OpenAI compatible API.
"""
import os
import sys
import json
import requests
from typing import Dict, Any, List, Optional

# API Key (replace with your actual API key)
API_KEY = "ak-130984-tdU8Rs604uqVmx-N-c2A3A"  # Example API key, replace with your own

# Base URL
BASE_URL = "http://localhost:8000"

# Headers
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}"
}


def test_chat_completion(assistant_name: str, messages: List[Dict[str, str]], stream: bool = False) -> Dict[str, Any]:
    """Test chat completion API."""
    url = f"{BASE_URL}/chat/completions"
    
    payload = {
        "model": assistant_name,
        "messages": messages,
        "stream": stream
    }
    
    if stream:
        response = requests.post(url, json=payload, headers=headers, stream=True)
        
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            print(response.text)
            return None
        
        print("Streaming response:")
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    data = line[6:]
                    if data == "[DONE]":
                        print("\n[DONE]")
                        break
                    try:
                        chunk = json.loads(data)
                        if "choices" in chunk and len(chunk["choices"]) > 0:
                            delta = chunk["choices"][0].get("delta", {})
                            if "content" in delta:
                                print(delta["content"], end="", flush=True)
                    except json.JSONDecodeError:
                        print(f"Error parsing JSON: {data}")
        
        return {"status": "streaming completed"}
    else:
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            print(response.text)
            return None
        
        return response.json()


def main():
    """Main function."""
    if len(sys.argv) < 2:
        print("Usage: python test_openai_api.py <assistant_name> [--stream]")
        sys.exit(1)
    
    assistant_name = sys.argv[1]
    stream = "--stream" in sys.argv
    
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Can you tell me what is amazon bedrock?"}
    ]
    
    result = test_chat_completion(assistant_name, messages, stream)
    
    if not stream and result:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
