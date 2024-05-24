import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { WebSocketService } from '../services/web-socket.service';
import { v4 as uuidv4 } from 'uuid';  // Importing UUID library for generating unique userId

@Component({
  selector: 'app-video-chat',
  templateUrl: './video-chat.component.html',
  styleUrls: ['./video-chat.component.scss']
})
export class VideoChatComponent implements OnInit {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  peerConnection: RTCPeerConnection;
  localStream: MediaStream;
  availableRooms: string[] = [];
  currentUsers: any;
  roomId: string;
  userId: string;

  constructor(private webSocketService: WebSocketService) {
    this.userId = uuidv4();
  }

  ngOnInit(): void {
    setTimeout(() => {
      // this.webSocketService.connect('ws://localhost:8083');
      this.webSocketService.connect('wss://dev.api.deerstudio.sg/ws/');
      this.webSocketService.handleMessage = this.handleMessage.bind(this);
    }, 1000);
    this.startVideo();
  }

  startVideo(): void {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        this.localVideo.nativeElement.srcObject = stream;
        this.localStream = stream;
      })
      .catch(error => console.error('Error accessing media devices.', error));
  }

  createRoom(contentType: 'video' | 'screen' = 'video'): void {
    const newRoomId = Date.now().toString();
    this.webSocketService.send({ type: 'create', room: newRoomId, userId: this.userId, contentType });
    this.roomId = newRoomId;
  }

  joinRoom(roomId: string, contentType: 'video' | 'screen' = 'video'): void {
    this.webSocketService.send({ type: 'join', room: roomId, userId: this.userId, contentType });
    this.roomId = roomId;
    if (!this.peerConnection) {
      this.setupPeerConnection();
    }
  }

  setupPeerConnection(): void {
    console.log("Setting up peer connection");
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.peerConnection = new RTCPeerConnection(configuration);

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    this.peerConnection.ontrack = (event) => {
      this.remoteVideo.nativeElement.srcObject = event.streams[0];
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.webSocketService.send({
          type: 'candidate',
          candidate: event.candidate.toJSON(),
          room: this.roomId,
          userId: this.userId
        });
      }
    };

    // Handle negotiation needed
    this.peerConnection.onnegotiationneeded = () => {
      this.peerConnection.createOffer()
        .then(offer => this.peerConnection.setLocalDescription(offer))
        .then(() => {
          this.webSocketService.send({
            type: 'offer',
            offer: this.peerConnection.localDescription,
            room: this.roomId,
            userId: this.userId
          });
        })
        .catch(error => console.error('Error creating offer:', error));
    };
  }

  handleMessage(message: any): void {
    console.log('Received message:', message);
    switch (message.type) {
      case 'offer':
        if (!this.peerConnection) {
          this.setupPeerConnection();
        }
        this.handleOffer(message.offer);
        break;
      case 'answer':
        this.handleAnswer(message.answer);
        break;
      case 'candidate':
        if (this.peerConnection) {
          this.handleCandidate(message.candidate);
        }
        break;
      case 'roomList':
        this.availableRooms = message.rooms;
        break;
      case 'currentUsers':
        this.currentUsers = message.users;
        if (!this.peerConnection && message.users.length > 1) {
          this.setupPeerConnection();
        }
        break;
      case 'participantLeft':
        this.handleParticipantLeft(message.id);
        break;
      default:
        console.error('Unknown message type:', message.type);
    }
  }

  handleOffer(offer): void {
    console.log("Handling offer", offer);
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => this.peerConnection.createAnswer())
      .then(answer => this.peerConnection.setLocalDescription(answer))
      .then(() => {
        this.webSocketService.send({
          type: 'answer',
          answer: this.peerConnection.localDescription,
          room: this.roomId,
          userId: this.userId
        });
      })
      .catch(error => console.error('Error handling offer:', error));
  }

  handleAnswer(answer: RTCSessionDescriptionInit): void {
    console.log("Handling answer", answer);
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      .catch(error => console.error('Error setting remote description:', error));
  }

  handleCandidate(candidate: RTCIceCandidateInit): void {
    console.log("Handling candidate", candidate);
    this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      .catch(error => console.error('Error adding ICE candidate:', error));
  }

  handleParticipantLeft(participantId: string): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      this.remoteVideo.nativeElement.srcObject = null;
    }
  }
}