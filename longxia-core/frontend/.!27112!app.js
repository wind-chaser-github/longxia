// 动态环境检测：如果是 file: 协议，则默认指向 http://localhost:8080/api/v1（因为当前主服务运行在 8080 端口）。如果是 http/https 协议，则直接使用同源相对路径 '/api/v1' 与同源 WebSocket。
const isFileProtocol = window.location.protocol === 'file:';
const API_BASE = isFileProtocol ? 'http://localhost:8080/api/v1' : '/api/v1';
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = isFileProtocol ? 'ws://localhost:8080/ws/events' : `${wsProtocol}//${window.location.host}/ws/events`;

// ── 优雅的 Toast 通知系统 (Premium Toast Notifications) ──
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const bg = type === 'error' ? 'rgba(244,63,94,0.9)' : (type === 'success' ? 'rgba(16,185,129,0.9)' : 'rgba(6,182,212,0.9)');
    toast.style.cssText = `background:${bg}; color:#fff; padding:12px 24px; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.3); backdrop-filter:blur(10px); font-size:0.9rem; font-weight:600; transform:translateY(-20px); opacity:0; transition:all 0.3s cubic-bezier(0.16,1,0.3,1); pointer-events:auto;`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; }, 50);
    setTimeout(() => {
        toast.style.transform = 'translateY(-20px)'; toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// View Navigation Elements
const navStudioBtn = document.getElementById('nav-studio-btn');
const navExpertsBtn = document.getElementById('nav-experts-btn');
const navSkillsBtn = document.getElementById('nav-skills-btn');
const navToolsBtn = document.getElementById('nav-tools-btn');
const navConfigBtn = document.getElementById('nav-config-btn');
const navHistoryBtn = document.getElementById('nav-history-btn');

const studioView = document.getElementById('studio-view');
const expertsView = document.getElementById('experts-view');
const skillsView = document.getElementById('skills-view');
const toolsView = document.getElementById('tools-view');
const configView = document.getElementById('config-view');
const historyView = document.getElementById('history-view');

// Studio Elements
const startBtn = document.getElementById('start-btn');
const approveBtn = document.getElementById('approve-btn');
const workflowSelect = document.getElementById('workflow-select');
const promptInput = document.getElementById('prompt-input');
const sessionIdDisplay = document.getElementById('session-id-display');
const traceContainer = document.getElementById('trace-container');
const hitlPanel = document.getElementById('hitl-panel');
const hitlMessage = document.getElementById('hitl-message');
const finalResult = document.getElementById('final-result');

// Experts & Skills & Tools Elements
const expertsGrid = document.getElementById('experts-grid');
const skillsGrid = document.getElementById('skills-grid');
const toolsGrid = document.getElementById('tools-grid');

// Config Elements
const configList = document.getElementById('config-list');
const configForm = document.getElementById('config-form');
const resetFormBtn = document.getElementById('reset-form-btn');
const formTitle = document.getElementById('form-title');

// Detail Modal Elements
const detailModal = document.getElementById('detail-modal');
const closeDetailBtn = document.getElementById('close-detail-btn');
const modalDetailTitle = document.getElementById('modal-detail-title');
const modalDetailBody = document.getElementById('modal-detail-body');

// Expert Modal Elements
const expertModal = document.getElementById('expert-modal');
const closeExpertModalBtn = document.getElementById('close-expert-modal-btn');
const cancelExpertBtn = document.getElementById('cancel-expert-btn');
const expertForm = document.getElementById('expert-form');
const addExpertBtn = document.getElementById('add-expert-btn');
const expertModalTitle = document.getElementById('expert-modal-title');

let currentSessionId = null;
let ws = null;
let heartbeatInterval = null;
let allConfigs = [];
let allExperts = [];
let allSkills = [];
let allTools = [];

// ── 1. 导航选项卡切换逻辑 (Navigation Tab Switcher) ──
function switchView(activeBtn, activeView, callback) {
    [navStudioBtn, navExpertsBtn, navSkillsBtn, navToolsBtn, navConfigBtn, navHistoryBtn].forEach(b => b.classList.remove('active'));
    [studioView, expertsView, skillsView, toolsView, configView, historyView].forEach(v => v.classList.remove('active'));
    
    activeBtn.classList.add('active');
    activeView.classList.add('active');
    if (callback) callback();
}

navStudioBtn.addEventListener('click', () => switchView(navStudioBtn, studioView));
navExpertsBtn.addEventListener('click', () => switchView(navExpertsBtn, expertsView, loadExperts));
navSkillsBtn.addEventListener('click', () => switchView(navSkillsBtn, skillsView, loadSkills));
navToolsBtn.addEventListener('click', () => switchView(navToolsBtn, toolsView, loadTools));
navConfigBtn.addEventListener('click', () => switchView(navConfigBtn, configView, loadConfigs));
navHistoryBtn.addEventListener('click', () => switchView(navHistoryBtn, historyView, loadHistory));

document.getElementById('refresh-history-btn')?.addEventListener('click', loadHistory);

async function loadHistory() {
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<div class="empty-state"><p>正在实时拉取过往调研与推演记录...</p></div>';
    
    try {
        const res = await fetch(`${API_BASE}/tasks/history`);
        const data = await res.json();
        if (data.status === 'ok' && data.history && data.history.length > 0) {
            listContainer.innerHTML = '';
            data.history.forEach((item, index) => {
                const card = document.createElement('div');
                card.className = 'glass-panel history-card';
                card.style.cssText = 'padding: 1.2rem; margin-bottom: 1rem; border-radius: 12px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid rgba(6,182,212,0.2); background: rgba(0,0,0,0.5); backdrop-filter: blur(12px);'; card.id = `hist-card-${item.session_id}`;
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                        <span style="font-weight:700; color:#06b6d4; font-size:1.05rem; display:flex; align-items:center; gap:0.5rem;"><span style="font-size:1.2rem;">${item.session_id.includes('workbuddy') ? '🔥' : '⚡'}</span>${item.session_id}</span>
                        <span style="font-size:0.8rem; color:#94a3b8; background: rgba(255,255,255,0.05); padding:0.2rem 0.6rem; border-radius:12px;">${new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    <p style="font-size:0.88rem; color:#cbd5e1; margin:0; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-family: 'Noto Sans SC', sans-serif;">
                        ${item.preview}
                    </p>
                `;
                card.onmouseover = () => { if (currentSessionId !== item.session_id) { card.style.borderColor = '#10b981'; card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 8px 24px rgba(16,185,129,0.2)'; } };
                card.onmouseout = () => { if (currentSessionId !== item.session_id) { card.style.borderColor = 'rgba(6,182,212,0.2)'; card.style.transform = 'none'; card.style.boxShadow = 'none'; } };
                card.onclick = () => {
                    document.querySelectorAll('.history-card').forEach(c => { c.style.borderColor = 'rgba(6,182,212,0.2)'; c.style.background = 'rgba(0,0,0,0.5)'; c.style.boxShadow = 'none'; });
                    card.style.borderColor = '#10b981'; card.style.background = 'rgba(16,185,129,0.1)'; card.style.boxShadow = '0 0 20px rgba(16,185,129,0.3)';
                    loadTaskDetail(item.session_id);
                };
                listC        } else {
            listContainer.innerHTML = '<div class="empty-state"><p>暂无任何过往测试与调研记录</p></div>';
        }
    } catch (e) {
        listContainer.innerHTML = `<div class="empty-state"><p style="color:#f43f5e;">拉取记录失败: ${e.message}</p></div>`;
    }
}

async function loadTaskDetail(sessionId) {
    currentSessionId = sessionId;
    const traceTitleEl = document.getElementById('history-trace-title');
    const traceBodyEl = document.getElementById('history-trace-body');
    const deliveryBodyEl = document.getElementById('history-delivery-body');
    if (!traceBodyEl || !deliveryBodyEl) return;
    
    if (traceTitleEl) traceTitleEl.innerHTML = `<span style="color:#06b6d4;">专家推演监控:</span> ${sessionId}`;
    traceBodyEl.innerHTML = '<div class="empty-state"><p class="status-pulse" style="display:inline-block; width:12px; height:12px; margin-right:8px;"></p>正在解析深度推演链路与工具调度轨迹...</div>';
    deliveryBodyEl.innerHTML = '<div class="empty-state"><p class="status-pulse" style="display:inline-block; width:12px; height:12px; margin-right:8px;"></p>正在生成最终成果交付物预览...</div>';
    
    try {
        const res = await fetch(`${API_BASE}/tasks/history/${sessionId}`);
        const data = await res.json();
        if (data.status === 'ok' && data.messages && data.messages.length > 0) {
            traceBodyEl.innerHTML = '';
            deliveryBodyEl.innerHTML = '';
            
            // 顶层全局样式注入（针对 Markdown 和 Mermaid）
            const styleId = 'custom-markdown-style';
            if (!document.getElementById(styleId)) {
                const styleEl = document.createElement('style');
                styleEl.id = styleId;
                styleEl.innerHTML = `
                    .custom-markdown-container { font-family: 'Noto Sans SC', sans-serif; color: #f8fafc; line-height: 1.8; font-size: 0.98rem; }
                    .custom-markdown-container h1 { font-size: 1.8rem; color: #10b981; border-bottom: 2px solid rgba(16,185,129,0.3); padding-bottom: 0.5rem; margin-top: 1.5rem; margin-bottom: 1rem; }
                    .custom-markdown-container h2 { font-size: 1.4rem; color: #06b6d4; border-bottom: 1px solid rgba(6,182,212,0.3); padding-bottom: 0.4rem; margin-top: 1.5rem; margin-bottom: 0.8rem; }
                    .custom-markdown-container h3 { font-size: 1.15rem; color: #38bdf8; margin-top: 1.2rem; margin-bottom: 0.6rem; }
                    .custom-markdown-container table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.9rem; background: rgba(0,0,0,0.4); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
                    .custom-markdown-container th { background: rgba(6,182,212,0.2); color: #06b6d4; font-weight: 700; padding: 1rem; text-align: left; border-bottom: 1px solid rgba(6,182,212,0.3); }
                    .custom-markdown-container td { padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: #cbd5e1; vertical-align: top; }
                    .custom-markdown-container tr:last-child td { border-bottom: none; }
                    .custom-markdown-container tr:hover td { background: rgba(255,255,255,0.03); color: #f8fafc; }
                    .custom-markdown-container blockquote { border-left: 4px solid #10b981; background: rgba(16,185,129,0.05); margin: 1.2rem 0; padding: 1rem 1.5rem; border-radius: 0 8px 8px 0; color: #a7f3d0; font-style: italic; }
                    .custom-markdown-container code { font-family: 'Fira Code', monospace; background: rgba(0,0,0,0.6); color: #38bdf8; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.85em; }
                    .custom-markdown-container pre { background: rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.1); padding: 1.2rem; border-radius: 8px; overflow-x: auto; margin: 1.5rem 0; }
                    .custom-markdown-container pre code { background: none; padding: 0; color: #e2e8f0; font-size: 0.9em; }
                    .custom-markdown-container ul, .custom-markdown-container ol { padding-left: 1.5rem; margin: 1rem 0; }
                    .custom-markdown-container li { margin-bottom: 0.5rem; }
                    .custom-cot-panel { background: rgba(0,0,0,0.4); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; margin-bottom: 1.5rem; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
                    .custom-cot-header { background: rgba(16,185,129,0.15); padding: 1rem 1.5rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 700; color: #10b981; border-bottom: 1px solid rgba(16,185,129,0.2); transition: background 0.2s; }
                    .custom-cot-header:hover { background: rgba(16,185,129,0.25); }
                    .custom-cot-body { padding: 1.5rem; color: #cbd5e1; font-size: 0.92rem; line-height: 1.6; background: rgba(0,0,0,0.6); }
                    .custom-tool-badge { display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(6,182,212,0.15); border: 1px solid #06b6d4; color: #06b6d4; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.8rem; margin-right: 0.5rem; }
                    .custom-artifact-card { background: linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(16,185,129,0.1) 100%); border: 1px solid #06b6d4; border-radius: 12px; padding: 1.5rem; margin-top: 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 32px rgba(6,182,212,0.2); }
                `;
                document.head.appendChild(styleEl);
            }

            let finalMarkdownContent = '';
            let finalArtifactCardHtml = '';

            data.messages.forEach((msg, idx) => {
                const isUser = msg.type === 'user';
                let textContent = msg.content || '';
                
                // 判断是否是最后一轮包含产物或大段报告的消息
                const isFinalReport = textContent.includes('ai-agent-research-report.md') || textContent.includes('任务产生制品') || textContent.includes('write_file') || textContent.includes('终极调研产物') || idx === data.messages.length - 1;

                if (isUser) {
                    const bubble = document.createElement('div');
                    bubble.style.cssText = `margin-bottom: 1.5rem; padding: 1.2rem 1.5rem; border-radius: 12px; background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.3); border-left: 4px solid #06b6d4; box-shadow: 0 4px 20px rgba(0,0,0,0.2);`;
                    bubble.innerHTML = `
                        <div style="font-size:0.85rem; color:#06b6d4; margin-bottom:0.8rem; display:flex; justify-content:space-between; align-items:center; font-weight:700;">
                            <span>👤 指挥官下达指令</span>
                            <span>${new Date(msg.created_at).toLocaleString()}</span>
                        </div>
                        <div style="font-size:1.05rem; font-weight:600; color:#e2e8f0; line-height:1.6;">${msg.content}</div>
                    `;
                    traceBodyEl.appendChild(bubble);
                } else {
                    // 提取底层工具调用链
                    let toolBadgesHtml = '';
                    const toolRegex = /\[(.*?)\]/g;
                    let match;
                    const foundTools = [];
                    while ((match = toolRegex.exec(textContent)) !== null) {
                        foundTools.push(match[1]);
                    }
                    if (foundTools.length > 0) {
                        toolBadgesHtml = `<div style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center;">`;
                        foundTools.forEach(t => {
                            let icon = '⚙️';
                            if (t.includes('search')) icon = '🔍';
                            if (t.includes('file') || t.includes('grep')) icon = '📁';
                            if (t.includes('spawn')) icon = '🧬';
                            toolBadgesHtml += `<span class="custom-tool-badge" style="margin:0; background:rgba(6,182,212,0.15); border:1px solid #06b6d4; color:#06b6d4; padding:0.3rem 0.8rem; border-radius:20px; font-size:0.85rem; font-weight:600;">${icon} 底层沙盒调用: ${t}</span>`;
                        });
                        toolBadgesHtml += `</div>`;
                    }

                    // 提取思维链与正文拆分
                    let cotText = textContent;
                    let markdownPart = textContent;
                    const firstHeaderIndex = textContent.search(/(^|\n)#/);
                    if (textContent.includes('需求分析：') && firstHeaderIndex !== -1) {
                        cotText = textContent.substring(0, firstHeaderIndex).trim();
                        markdownPart = textContent.substring(firstHeaderIndex).trim();
                    } else if (textContent.includes('需求分析：')) {
                        cotText = textContent;
                        markdownPart = '';
                    }

                    // 在中间栏 (traceBodyEl) 渲染专家的思维链与工具调度监控卡片
                    const traceBubble = document.createElement('div');
                    traceBubble.style.cssText = `margin-bottom: 1.5rem; padding: 1.2rem 1.5rem; border-radius: 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(234,179,8,0.3); border-left: 4px solid #eab308; box-shadow: 0 4px 20px rgba(0,0,0,0.2);`;
                    const cotId = `cot-${Math.random().toString(36).substr(2,9)}`;
                    traceBubble.innerHTML = `
                        <div style="font-size:0.85rem; color:#eab308; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; font-weight:700; border-bottom:1px solid rgba(234,179,8,0.2); padding-bottom:0.6rem;">
                            <span>🧠 专家智能体思考链路与沙盒调度监控</span>
                            <span>${new Date(msg.created_at).toLocaleString()}</span>
                        </div>
                        ${toolBadgesHtml}
                        <div class="custom-cot-panel" style="margin:0;">
                            <div class="custom-cot-header" onclick="document.getElementById('${cotId}').classList.toggle('hidden')">
                                <span>🧠 展开/折叠 详细神经推演与动作计划</span>
                                <span style="font-size:0.8rem; background:rgba(234,179,8,0.2); color:#eab308; padding:0.2rem 0.6rem; border-radius:12px;">已校验</span>
                            </div>
                            <div id="${cotId}" class="custom-cot-body" style="padding: 1.2rem; color: #cbd5e1; font-size: 0.9rem; line-height: 1.6; background: rgba(0,0,0,0.6);">
                                <div style="white-space:pre-wrap; font-family:inherit;">${cotText}</div>
                            </div>
                        </div>
                    `;
                    traceBodyEl.appendChild(traceBubble);

                    // 收集 Markdown 报告内容到右侧栏
                    if (markdownPart) {
                        finalMarkdownContent += `${markdownPart}\n\n`;
                    }
                    if (isFinalReport) {
                        finalArtifactCardHtml = `
                            <div class="custom-artifact-card" style="background: linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(16,185,129,0.1) 100%); border: 1px solid #06b6d4; border-radius: 12px; padding: 1.5rem; margin-top: 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 32px rgba(6,182,212,0.2);">
                                <div style="display:flex; align-items:center; gap:1rem;">
                                    <span style="font-size:2.5rem;">📦</span>
                                    <div>
                                        <div style="font-size:1.1rem; font-weight:700; color:#06b6d4;">任务产生制品 (Deliverables & Attachments)</div>
                                        <div style="font-size:0.85rem; color:#94a3b8; margin-top:0.2rem;">包含完整的 AI Agent 竞品深度对比、市场规模数据表及象限图源文件</div>
                                        <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
                                            <span style="background:rgba(6,182,212,0.2); color:#06b6d4; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.8rem; font-weight:600;">ai-agent-research-report.md</span>
                                            <span style="background:rgba(16,185,129,0.2); color:#10b981; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.8rem; font-weight:600;">文件变更 (1个)</span>
                                        </div>
                                    </div>
                                </div>
                                <button class="gradient-button" onclick="downloadReport('${sessionId}')" style="padding: 0.8rem 1.5rem;"><span class="btn-text">下载完整产物包</span><span class="btn-glow"></span></button>
                            </div>
                        `;
                    }
                }
            });

            // 在右侧栏 (deliveryBodyEl) 集中渲染排版精美绝伦的完整 Markdown 研报、Mermaid 图表及产物下载卡片
            if (finalMarkdownContent || finalArtifactCardHtml) {
                deliveryBodyEl.innerHTML = `
                    <div class="custom-markdown-container">
                        ${finalMarkdownContent ? marked.parse(finalMarkdownContent) : '<div class="empty-state"><p>该会话暂无 Markdown 格式的报告正文</p></div>'}
                    </div>
                    ${finalArtifactCardHtml}
                `;
            } else {
                deliveryBodyEl.innerHTML = '<div class="empty-state"><p>该会话暂无最终成果交付物</p></div>';
            }

            // 延迟渲染 Mermaid 图表
            setTimeout(() => {
                try {
                    mermaid.init(undefined, deliveryBodyEl.querySelectorAll('.language-mermaid'));
                } catch (err) {
                    console.warn("Mermaid 渲染提示", err);
                }
            }, 100);

        } else {
            traceBodyEl.innerHTML = '<div class="empty-state"><p>该会话暂无具体推演记录</p></div>';
            deliveryBodyEl.innerHTML = '<div class="empty-state"><p>该会话暂无最终成果交付物</p></div>';
        }
    } catch (e) {
        traceBodyEl.innerHTML = `<div class="empty-state"><p style="color:#f43f5e;">加载监控失败: ${e.message}</p></div>`;
        deliveryBodyEl.innerHTML = `<div class="empty-state"><p style="color:#f43f5e;">加载产物失败: ${e.message}</p></div>`;
    }
