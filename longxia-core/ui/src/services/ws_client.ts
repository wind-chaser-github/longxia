// MockElectronBridge.ts
// 核心“间谍”粘合剂代码：拦截 LobsterAI 的 window.electron 调用并将其重定向至 WebSocket

export class MockElectronBridge {
  private ws!: WebSocket;
  private wsUrl: string;
  private messageListeners: Set<(payload: any) => void> = new Set();
  private updateListeners: Set<(payload: any) => void> = new Set();
  private statusListeners: Set<(payload: any) => void> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private pingInterval: any = null;

  constructor(wsUrl: string = "ws://localhost:8081/ws/events") {
    this.wsUrl = wsUrl;
    this.connect();
    this.injectIntoWindow();
  }

  private connect() {
    this.ws = new WebSocket(this.wsUrl);
    
    this.ws.onopen = () => {
      console.log("[WebSocket Tunnel] Connected to Longxia Backend");
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === "pong") return; // 心跳回执
      this._routeEvent(data);
    };

    this.ws.onclose = () => {
      console.warn("[WebSocket Tunnel] Disconnected. Attempting to reconnect...");
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error("[WebSocket Tunnel] Error:", err);
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: "ping", timestamp: Date.now() }));
      }
    }, 15000); // 每15秒发送一次心跳
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.reconnectAttempts++;
      console.log(`[WebSocket Tunnel] Reconnecting in ${backoffTime}ms (Attempt ${this.reconnectAttempts})...`);
      setTimeout(() => this.connect(), backoffTime);
    } else {
      console.error("[WebSocket Tunnel] Max reconnect attempts reached. Please check backend service.");
    }
  }

  private activeMessageIds: Map<string, string> = new Map();

  private _routeEvent(data: any) {
    const { trace_id, event_type, payload } = data;
    
    // 核心转译：将 Python 的 SystemEvent 强制伪装成 LobsterAI CoworkMessage
    if (event_type === "WORKFLOW_START" || event_type === "AGENT_ACTIVATED") {
      this.statusListeners.forEach(cb => cb({ sessionId: trace_id, status: 'running' }));
    }
    
    if (event_type === "THINKING_START") {
      const newMsgId = `msg_${Date.now()}`;
      this.activeMessageIds.set(trace_id, newMsgId);
      const mockMsg = {
        sessionId: trace_id,
        message: {
          id: newMsgId,
          type: 'assistant',
          content: `[${payload.agent || '专家网络'} 介入思考中...]`,
          timestamp: Date.now()
        }
      };
      this.messageListeners.forEach(cb => cb(mockMsg));
    }
    
    if (event_type === "STREAM_TEXT") {
       // 更新最新的 message 内容，欺骗 LobsterAI 的渲染流水线
       const activeId = this.activeMessageIds.get(trace_id) || `msg_${Date.now()}`;
       const mockUpdate = {
         sessionId: trace_id,
         messageId: activeId,
         content: payload.delta,
         metadata: { isFinal: false }
       };
       this.updateListeners.forEach(cb => cb(mockUpdate));
    }
    
    if (event_type === "WORKFLOW_END") {
       const activeId = this.activeMessageIds.get(trace_id) || `msg_${Date.now()}`;
       const mockUpdate = {
         sessionId: trace_id,
         messageId: activeId,
         content: "", // 保持现有文本，标记 isFinal
         metadata: { isFinal: true }
       };
       this.updateListeners.forEach(cb => cb(mockUpdate));
       this.statusListeners.forEach(cb => cb({ sessionId: trace_id, status: 'completed' }));
    }
    
    if (event_type === "HITL_SUSPEND") {
      // 触发导演大屏挂起动画
      window.dispatchEvent(new CustomEvent('longxia:hitl:suspend', { detail: payload }));
    }
  }

  /** 将自己“偷天换日”注入到全局环境 */
  public injectIntoWindow() {
    (window as any).electron = {
      cowork: {
        onStreamMessage: (cb: any) => { this.messageListeners.add(cb); return () => this.messageListeners.delete(cb); },
        onStreamMessageUpdate: (cb: any) => { this.updateListeners.add(cb); return () => this.updateListeners.delete(cb); },
        onStreamSessionStatus: (cb: any) => { this.statusListeners.add(cb); return () => this.statusListeners.delete(cb); },
      }
    };
    console.log("[MockElectronBridge] 成功伪装 window.electron.cowork API");
  }
}

// 在单页面应用入口处仅执行一次
// new MockElectronBridge();
