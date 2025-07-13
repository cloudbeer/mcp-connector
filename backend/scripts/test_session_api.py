#!/usr/bin/env python
"""
Test script for OpenAI compatible API with session management.
"""
import os
import sys
import json
import uuid
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


def test_chat_completion_with_session(
    assistant_name: str, 
    messages: List[Dict[str, str]], 
    session_id: Optional[str] = None,
    stream: bool = False
) -> Dict[str, Any]:
    """Test chat completion API with session management."""
    url = f"{BASE_URL}/chat/completions"
    
    # Add session ID to headers if provided
    request_headers = headers.copy()
    if session_id:
        request_headers["Session-ID"] = session_id
    
    payload = {
        "model": assistant_name,
        "messages": messages,
        "stream": stream
    }
    
    if stream:
        response = requests.post(url, json=payload, headers=request_headers, stream=True)
        
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            print(response.text)
            return None
        
        # Get session ID from response headers
        returned_session_id = response.headers.get("Session-ID")
        if returned_session_id:
            print(f"Session ID from response: {returned_session_id}")
        
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
        
        # Return the session ID from response headers
        return {
            "status": "streaming completed",
            "session_id": returned_session_id
        }
    else:
        response = requests.post(url, json=payload, headers=request_headers)
        
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            print(response.text)
            return None
        
        # Get session ID from response headers
        returned_session_id = response.headers.get("Session-ID")
        if returned_session_id:
            print(f"Session ID from response: {returned_session_id}")
        
        # Return the result with session ID
        result = response.json()
        result["session_id"] = returned_session_id
        return result


def test_session_management():
    """Test session management endpoints."""
    # List sessions
    response = requests.get(f"{BASE_URL}/sessions", headers=headers)
    if response.status_code == 200:
        print("Active sessions:")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"Error listing sessions: {response.status_code}")
        print(response.text)
    
    # Close a specific session
    session_id = input("Enter session ID to close (or press Enter to skip): ")
    if session_id:
        response = requests.delete(f"{BASE_URL}/sessions/{session_id}", headers=headers)
        if response.status_code == 200:
            print(f"Session {session_id} closed successfully")
        else:
            print(f"Error closing session: {response.status_code}")
            print(response.text)
    
    # Close all sessions
    close_all = input("Close all sessions? (y/n): ")
    if close_all.lower() == 'y':
        response = requests.delete(f"{BASE_URL}/sessions", headers=headers)
        if response.status_code == 200:
            print("All sessions closed successfully")
        else:
            print(f"Error closing all sessions: {response.status_code}")
            print(response.text)


def main():
    """Main function."""
    if len(sys.argv) < 2:
        print("Usage: python test_session_api.py <assistant_name> [--stream] [--session-id <id>] [--new-session] [--manage-sessions]")
        sys.exit(1)
    
    # Check for session management command
    if "--manage-sessions" in sys.argv:
        test_session_management()
        return
    
    assistant_name = sys.argv[1]
    stream = "--stream" in sys.argv
    
    # Check for session ID
    session_id = None
    if "--session-id" in sys.argv:
        idx = sys.argv.index("--session-id")
        if idx + 1 < len(sys.argv):
            session_id = sys.argv[idx + 1]
    
    # Generate a new session ID if requested
    if not session_id and "--new-session" in sys.argv:
        session_id = str(uuid.uuid4())
        print(f"Generated new session ID: {session_id}")
    
    # Get message from command line or use default
    message = "What's the weather like today in New York?"
    if "--message" in sys.argv:
        idx = sys.argv.index("--message")
        if idx + 1 < len(sys.argv):
            message = sys.argv[idx + 1]
    
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": message}
    ]
    
    result = test_chat_completion_with_session(assistant_name, messages, session_id, stream)
    
    if not stream and result:
        print(json.dumps(result, indent=2))
        
        # Print the session ID for reuse
        if "session_id" in result and result["session_id"]:
            print(f"\nSession ID for reuse: {result['session_id']}")


if __name__ == "__main__":
    main()
