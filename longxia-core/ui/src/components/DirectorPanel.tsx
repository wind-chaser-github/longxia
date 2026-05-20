import React, { useEffect, useState } from 'react';

/**
 * 舞台防翻车/人工干预导演大屏
 * 拦截引擎抛出的 HITL_SUSPEND 并通过 API 放行
 */
export const DirectorPanel: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => {
    const handleSuspend = (e: any) => {
      setIsSuspended(true);
      setSuspendReason(e.detail.message || "请求进行危险或高权限操作");
    };
    
    // 监听来自 ws_client.ts 触发的自定义事件
    window.addEventListener('longxia:hitl:suspend', handleSuspend);
    return () => window.removeEventListener('longxia:hitl:suspend', handleSuspend);
  }, []);

  const handleResume = async () => {
    try {
      // 通过主后端的控制口发信号，解开 engine.py 里的 asyncio.Future 挂起锁！
      await fetch(`http://localhost:8081/api/v1/workflow/${sessionId}/hitl/resume`, {
        method: "POST"
      });
      setIsSuspended(false);
    } catch (err) {
      console.error("Failed to resume", err);
    }
  };

  if (!isSuspended) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(255, 0, 0, 0.4)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: '#1a1a1a', border: '2px solid #ff4444', borderRadius: '12px',
        padding: '30px', color: 'white', textAlign: 'center', maxWidth: '500px'
      }}>
        <h2 style={{ color: '#ff4444', margin: '0 0 15px 0' }}>⚠️ 警告：协同阻断</h2>
        <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
          系统已挂起大模型进程。<br/>
          <strong>原因：</strong> {suspendReason}
        </p>
        <div style={{ marginTop: '25px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button 
            onClick={handleResume}
            style={{ padding: '10px 20px', background: '#44ff44', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            强制放行 (Approve)
          </button>
          <button 
            style={{ padding: '10px 20px', background: 'transparent', color: '#ff4444', border: '1px solid #ff4444', borderRadius: '6px', cursor: 'pointer' }}
          >
            终止任务 (Abort)
          </button>
        </div>
      </div>
    </div>
  );
};
