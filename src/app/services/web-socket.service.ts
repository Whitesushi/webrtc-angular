import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: WebSocket;

  connect(url: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('WebSocket connection opened');
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
      };
    }
  }

  send(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not open. Unable to send message:', message);
    }
  }

  handleMessage(message: any): void {
    // This method should be overridden by the component to handle specific messages.
  }
}