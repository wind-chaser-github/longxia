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
const navShowcaseBtn = document.getElementById('nav-showcase-btn');
const navExpertsBtn = document.getElementById('nav-experts-btn');
const navSkillsBtn = document.getElementById('nav-skills-btn');
const navToolsBtn = document.getElementById('nav-tools-btn');
const navConfigBtn = document.getElementById('nav-config-btn');
const navHistoryBtn = document.getElementById('nav-history-btn');

const studioView = document.getElementById('studio-view');
const showcaseView = document.getElementById('showcase-view');
const expertsView = document.getElementById('experts-view');
const skillsView = document.getElementById('skills-view');
const toolsView = document.getElementById('tools-view');
const configView = document.getElementById('config-view');
const historyView = document.getElementById('history-view');

// Studio Elements
const startBtn = document.getElementById('start-btn');
const approveBtn = document.getElementById('approve-btn');
const engineTabs = document.querySelectorAll('.engine-tab');
const modeViewWorkflow = document.getElementById('mode-view-workflow');
const modeViewGeneral = document.getElementById('mode-view-general');
const workflowSelect = document.getElementById('workflow-select');
const generalSubmodeSelect = document.getElementById('general-submode-select');
const singleAgentContainer = document.getElementById('single-agent-container');
const agentSelect = document.getElementById('agent-select');
const customExpertsContainer = document.getElementById('custom-experts-container');
const promptInput = document.getElementById('prompt-input');
const sessionIdDisplay = document.getElementById('session-id-display');
const traceContainer = document.getElementById('trace-container');
const hitlPanel = document.getElementById('hitl-panel');
const hitlMessage = document.getElementById('hitl-message');
const finalResult = document.getElementById('final-result');
const tabCodeView = document.getElementById('tab-code-view');
const tabWebPreview = document.getElementById('tab-web-preview');
const webPreviewContainer = document.getElementById('web-preview-container');
const webPreviewIframe = document.getElementById('web-preview-iframe');

let rawFinalContent = ""; // 记录大模型输出的原始完整 Markdown/HTML 源码

function processMediaUrls(text) {
    if (!text) return "";
    // 1. 将绝对路径下的 /media/generated/... 转换为相对挂载路径 /media/generated/...
    let processed = text.replace(/(?:file:\/\/)?\/Users\/[^"'\s)>]+?\/media\/generated\//g, '/media/generated/');
    
    // 2. 将其他绝对路径图片 (例如 /Users/.../xxx.png 或 .jpg/.gif/.webp) 转换为 /api/file/download?path=...
    processed = processed.replace(/(?:file:\/\/)?(\/Users\/[^"'\s)>]+?\.(?:png|jpg|jpeg|gif|webp|svg))\b/gi, (match, p1) => {
        if (p1.includes('/media/generated/')) return p1;
        return `${API_BASE}/file/download?path=` + encodeURIComponent(p1);
    });
    return processed;
}

function renderFinalResultView(content, isExternalFile = false, externalPath = "") {
    const cleanContent = processMediaUrls(content);
    
    // 判断是否包含完整 HTML 页面源码
    const hasHtmlPage = cleanContent.includes('<!DOCTYPE html>') || cleanContent.includes('<html');
    const hasHtmlBlock = /```html\s*([\s\S]*?)\s*```/.test(cleanContent);
    
    if (hasHtmlPage || hasHtmlBlock) {
        // 如果是网页设计任务，在代码视图下为了防止 DOM 污染，展示高亮代码框
        let codeToShow = cleanContent;
        if (isExternalFile) {
            codeToShow = `─── 提取的本地文件源码 (${externalPath}) ───\n\n` + cleanContent;
        }
        finalResult.innerHTML = `<pre class="code-preview-box"><code>${escapeHtml(codeToShow)}</code></pre>`;
    } else {
        // 如果是 Markdown 调研报告、文章等，使用 marked 渲染出带高清图片的完美排版！
        if (typeof marked !== 'undefined') {
            finalResult.innerHTML = marked.parse(cleanContent);
        } else {
            finalResult.innerHTML = cleanContent.replace(/\n/g, '<br>');
        }
    }
    finalResult.scrollTop = finalResult.scrollHeight;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function cleanHtmlContent(content) {
    if (!content) return "";
    let cleaned = content.replace(/^```html\s*/i, "").replace(/\s*```$/, "");
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    return cleaned.trim();
}

function injectRobustDependencies(htmlStr) {
    if (!htmlStr) return "";
    let res = htmlStr;
    
    let polyfills = "";
    
    // 如果包含 mermaid 但缺少脚本，注入防御性 mermaid 存根与同步加载逻辑
    if (res.includes('mermaid')) {
        polyfills += `
            <script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.0/mermaid.min.js"></script>
            <script>
                if (typeof mermaid === 'undefined') {
                    window.mermaid = { initialize: function(){}, init: function(){} };
                }
            </script>
        `;
    }
    
    // 如果包含 Chart 但缺少脚本，注入 Chart.js 外链与存根
    if (res.includes('Chart')) {
        polyfills += `
            <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
            <script>
                if (typeof Chart === 'undefined') {
                    window.Chart = function(){ return { destroy: function(){}, update: function(){} }; };
                }
            </script>
        `;
    }

    // 针对 Reveal.js 在 srcdoc 下调用 history.replaceState 导致 SecurityError 白屏的工业级猴子补丁与终极防重叠样式重置
    if (res.includes('reveal') || res.includes('Reveal')) {
        polyfills += `
            <style>
                /* 防御性样式重置：强制确保 Reveal.js 的非当前幻灯片严格隐藏，防止大模型自定义 CSS (如 display: flex) 导致前后幻灯片文字重叠不清理 */
                .reveal .slides > section.past,
                .reveal .slides > section.future {
                    display: none !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                }
                .reveal .slides > section.present {
                    display: block !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                    pointer-events: auto !important;
                }
                .reveal .slides > section.present.flex {
                    display: flex !important;
                }
            </style>
            <script>
                if (window.location.href.includes('srcdoc')) {
                    const noop = function(){};
                    window.history.replaceState = noop;
                    window.history.pushState = noop;
                    window.addEventListener('DOMContentLoaded', () => {
                        if (typeof Reveal !== 'undefined') {
                            const origInit = Reveal.initialize;
                            Reveal.initialize = function(config) {
                                config = config || {};
                                config.history = false;
                                config.hash = false;
                                return origInit.call(Reveal, config);
                            };
                        }
                    });
                }
            </script>
        `;
    }
    
    if (polyfills) {
        if (res.includes('</head>')) {
            res = res.replace('</head>', polyfills + '</head>');
        } else if (res.includes('<body')) {
            res = res.replace(/(<body[^>]*>)/i, '$1' + polyfills);
        } else {
            res = polyfills + res;
        }
    }
    return res;
}

async function loadPreviewContent(targetIframe, isCodeView = false) {
    let contentToRender = rawFinalContent;
    
    // 检查大模型输出文本中是否包含本地 HTML/MD/PPTX 文件路径
    const filePathMatch = rawFinalContent.match(/(?:\/Users\/[^\s"'`<>|]+?\.(?:html|md|pptx))|(?:(?:\.\/)?[\w.-]+?\.(?:html|md|pptx))/);
    if (filePathMatch) {
        try {
            const res = await fetch(`${API_BASE}/file/content?path=` + encodeURIComponent(filePathMatch[0]));
            if (res.ok) {
                const data = await res.json();
                if (isCodeView) {
                    renderFinalResultView(data.content, true, data.path);
                } else if (targetIframe) {
                    // 如果是 md 文件，在沙盒预览下渲染 HTML
                    if (data.path.endsWith('.md')) {
                        const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.min.css"><style>body{box-sizing:border-box;min-width:200px;max-width:980px;margin:0 auto;padding:45px;} @media (max-width:767px){body{padding:15px;}}</style></head><body class="markdown-body">${typeof marked !== 'undefined' ? marked.parse(processMediaUrls(data.content)) : processMediaUrls(data.content)}</body></html>`;
                        targetIframe.srcdoc = htmlDoc;
                    } else {
                        targetIframe.srcdoc = processMediaUrls(injectRobustDependencies(cleanHtmlContent(data.content)));
                    }
                }
                return;
            }
        } catch (e) {
            console.error("动态拉取本地生成文件失败:", e);
        }
    }

    if (isCodeView) {
        renderFinalResultView(rawFinalContent);
        return;
    }

    // 如果未匹配到独立文件，尝试从文本提取代码块或完整 HTML 结构
    const cleanContent = processMediaUrls(rawFinalContent);
    const match = cleanContent.match(/```html\s*([\s\S]*?)\s*```/);
    if (match) {
        contentToRender = match[1];
    } else if (cleanContent.includes('<!DOCTYPE html>') || cleanContent.includes('<html')) {
        const htmlMatch = cleanContent.match(/(<!DOCTYPE html>[\s\S]*|<\s*html[\s\S]*)/i);
        if (htmlMatch) contentToRender = htmlMatch[0];
    } else if (typeof marked !== 'undefined') {
        contentToRender = `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.min.css"><style>body{box-sizing:border-box;min-width:200px;max-width:980px;margin:0 auto;padding:45px;} @media (max-width:767px){body{padding:15px;}}</style></head><body class="markdown-body">${marked.parse(cleanContent)}</body></html>`;
    } else {
        contentToRender = `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.min.css"><style>body{box-sizing:border-box;min-width:200px;max-width:980px;margin:0 auto;padding:45px;} @media (max-width:767px){body{padding:15px;}}</style></head><body class="markdown-body"><pre style="white-space:pre-wrap; font-family:inherit;">${cleanContent}</pre></body></html>`;
    }
    if (targetIframe) targetIframe.srcdoc = contentToRender;
}

// 交付物双模态选项卡切换监听
tabCodeView.addEventListener('click', () => {
    tabCodeView.classList.add('active');
    tabWebPreview.classList.remove('active');
    finalResult.classList.add('active');
    finalResult.classList.remove('hidden');
    webPreviewContainer.classList.add('hidden');
    loadPreviewContent(null, true);
});

tabWebPreview.addEventListener('click', () => {
    tabWebPreview.classList.add('active');
    tabCodeView.classList.remove('active');
    webPreviewContainer.classList.remove('hidden');
    finalResult.classList.remove('active');
    finalResult.classList.add('hidden');
    loadPreviewContent(webPreviewIframe, false);
});


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
    [navStudioBtn, navShowcaseBtn, navExpertsBtn, navSkillsBtn, navToolsBtn, navConfigBtn, navHistoryBtn].forEach(b => b.classList.remove('active'));
    [studioView, showcaseView, expertsView, skillsView, toolsView, configView, historyView].forEach(v => v.classList.remove('active'));
    
    activeBtn.classList.add('active');
    activeView.classList.add('active');
    if (callback) callback();
}

navStudioBtn.addEventListener('click', () => switchView(navStudioBtn, studioView));
navShowcaseBtn.addEventListener('click', () => switchView(navShowcaseBtn, showcaseView));
navExpertsBtn.addEventListener('click', () => switchView(navExpertsBtn, expertsView, loadExperts));
navSkillsBtn.addEventListener('click', () => switchView(navSkillsBtn, skillsView, loadSkills));
navToolsBtn.addEventListener('click', () => switchView(navToolsBtn, toolsView, loadTools));
navConfigBtn.addEventListener('click', () => switchView(navConfigBtn, configView, loadConfigs));
navHistoryBtn.addEventListener('click', () => switchView(navHistoryBtn, historyView, loadHistory));

// ── 1.5 示例玩法演示数据字典 (Showcase Demo Repository) ──
const showcaseDemoData = {
    'media_studio_demo': {
        title: "跨媒体生图与数据可视化大屏",
        trace: [
            { type: "tool", content: "[doubao_seedream_call] 调度豆包旗舰文生图大模型 doubao-seedream-5-0-260128，生成赛博朋克未来城市交通监控大屏高清概念配图" },
            { type: "tool", content: "[generate_image_success] 成功生成高清配图资源：/media/generated/cyber_traffic_bg.png" },
            { type: "cot", content: "需求分析：用户请求设计赛博朋克风格未来城市交通监控大屏。首先生成极具未来感的高清概念图作为背景，随后在此基础上全栈开发带实时折线图与预警卡片的控制台页面。\n\n技术架构：采用深色琉璃拟态容器包裹数据看板，使用 SVG 绘制动态流光折线图，并植入实时滚动播报动画。" },
            { type: "tool", content: "[verifier_check_pass] 无情裁决器审查：DOM 层级结构与定位隔离审查通过，未发现任何图文重叠碰撞风险" }
        ],
        deliverable: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>赛博朋克未来交通监控大屏</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { margin: 0; padding: 20px; background: #0b0f19 url('https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&q=80') center/cover no-repeat; font-family: 'Orbitron', 'Noto Sans SC', sans-serif; color: #fff; overflow-y: auto; overflow-x: hidden; }
        .overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: linear-gradient(135deg, rgba(11,15,25,0.92) 0%, rgba(6,182,212,0.2) 100%); z-index: 1; pointer-events: none; }
        .dashboard { position: relative; z-index: 2; display: grid; grid-template-columns: 300px 1fr 350px; gap: 20px; max-width: 1800px; margin: 0 auto; min-height: calc(100vh - 40px); height: auto; }
        .panel { background: rgba(11, 15, 25, 0.75); backdrop-filter: blur(20px); border: 1px solid rgba(6,182,212,0.3); border-radius: 16px; padding: 24px; box-shadow: 0 0 30px rgba(6,182,212,0.15); display: flex; flex-direction: column; gap: 20px; }
        .panel::before { content: ''; position: absolute; top: 0; left: 0; width: 20px; height: 4px; background: #06b6d4; box-shadow: 0 0 15px #06b6d4; }
        h2 { font-size: 1.4rem; color: #06b6d4; margin: 0; display: flex; align-items: center; gap: 10px; text-transform: uppercase; letter-spacing: 2px; }
        .metric-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }
        .metric-val { font-size: 1.8rem; font-weight: 900; color: #38bdf8; text-shadow: 0 0 15px rgba(56,189,248,0.5); }
        .alert-box { border-left: 4px solid #f43f5e; background: rgba(244,63,94,0.1); padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 0.9rem; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.8; } 50% { opacity: 1; box-shadow: 0 0 15px rgba(244,63,94,0.3); } 100% { opacity: 0.8; } }
        .chart-container { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 1px dashed rgba(6,182,212,0.2); border-radius: 12px; padding: 20px; }
    </style>
</head>
<body>
    <div class="overlay"></div>
    <div class="dashboard">
        <div class="panel">
            <h2>🛰️ 核心指标 (Metrics)</h2>
            <div class="metric-card"><span>全城通航载具</span><span class="metric-val">14,289</span></div>
            <div class="metric-card"><span>天穹轨道拥堵率</span><span class="metric-val" style="color:#10b981;">12.4%</span></div>
            <div class="metric-card"><span>量子信标状态</span><span class="metric-val" style="color:#a855f7;">99.9%</span></div>
            <h2 style="margin-top:20px;">⚠️ 异常监控 (Alerts)</h2>
            <div class="alert-box">【红色预警】D-4磁悬浮干线突发能量波动，自动分流已启动</div>
            <div class="alert-box" style="border-color:#eab308; background:rgba(234,179,8,0.1);">【黄色注意】第7空港货运无人机进场排队超时</div>
        </div>
        <div class="panel" style="justify-content: space-between;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2>🌐 未来城市交通主控台 (Cyber Traffic Nexus)</h2>
                <span style="background:rgba(6,182,212,0.2); color:#06b6d4; padding:6px 16px; border-radius:20px; font-weight:700; font-size:0.9rem; box-shadow:0 0 15px rgba(6,182,212,0.3);">系统全功率运转中</span>
            </div>
            <div class="chart-container">
                <svg width="100%" height="300" viewBox="0 0 800 300">
                    <defs>
                        <linearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="rgba(6,182,212,0.4)"/>
                            <stop offset="100%" stop-color="rgba(6,182,212,0.0)"/>
                        </linearGradient>
                    </defs>
                    <path d="M 0 250 Q 200 100 400 200 T 800 150 L 800 300 L 0 300 Z" fill="url(#gridGrad)" />
                    <path d="M 0 250 Q 200 100 400 200 T 800 150" fill="none" stroke="#06b6d4" stroke-width="4" stroke-linecap="round" filter="drop-shadow(0 0 10px #06b6d4)" />
                    <circle cx="400" cy="200" r="8" fill="#fff" stroke="#06b6d4" stroke-width="4" filter="drop-shadow(0 0 15px #fff)" />
                    <circle cx="600" cy="175" r="8" fill="#fff" stroke="#f43f5e" stroke-width="4" filter="drop-shadow(0 0 15px #f43f5e)" />
                </svg>
                <span style="color:#94a3b8; font-size:0.9rem; margin-top:15px;">全息轨道流量波动分析图谱 (实时数据传输率 1.2TB/s)</span>
            </div>
            <div style="display:flex; gap:15px;">
                <div style="flex:1; background:rgba(255,255,255,0.05); padding:16px; border-radius:12px; text-align:center;">
                    <div style="color:#94a3b8; font-size:0.85rem; margin-bottom:5px;">AI 调度效率提升</div>
                    <div style="font-size:1.5rem; font-weight:700; color:#10b981;">+42.8%</div>
                </div>
                <div style="flex:1; background:rgba(255,255,255,0.05); padding:16px; border-radius:12px; text-align:center;">
                    <div style="color:#94a3b8; font-size:0.85rem; margin-bottom:5px;">碳中和微电网效能</div>
                    <div style="font-size:1.5rem; font-weight:700; color:#06b6d4;">98.6%</div>
                </div>
            </div>
        </div>
        <div class="panel">
            <h2>🧬 专家智能体状态</h2>
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="padding:12px; background:rgba(6,182,212,0.1); border:1px solid #06b6d4; border-radius:8px;">
                    <div style="font-weight:700; color:#06b6d4;">💻 架构参谋 (全栈主理人)</div>
                    <div style="font-size:0.85rem; color:#cbd5e1; margin-top:4px;">响应式大屏 DOM 树生成完毕，自适应布局锁定</div>
                </div>
                <div style="padding:12px; background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:8px;">
                    <div style="font-weight:700; color:#10b981;">✨ UIUX 参谋 (设计大师)</div>
                    <div style="font-size:0.85rem; color:#cbd5e1; margin-top:4px;">赛博朋克深色调色盘注入，玻璃拟态参数最优解</div>
                </div>
                <div style="padding:12px; background:rgba(168,85,247,0.1); border:1px solid #a855f7; border-radius:8px;">
                    <div style="font-weight:700; color:#a855f7;">⚖️ 无情裁决器 (核查官)</div>
                    <div style="font-size:0.85rem; color:#cbd5e1; margin-top:4px;">图文防重叠与溢出测试 100% 达标，予以发布</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`
    },

    'mobile_app_demo': {
        title: "带有 iPhone 15 Pro 外壳的拟态应用",
        trace: [
            { type: "tool", content: "[opendesign_contract_init] 初始化 OpenDesign 移动端排版隔离契约，载入 mobile-onboarding 规范" },
            { type: "cot", content: "需求分析：用户请求设计拥有 3 个交互界面的高端 AI 冥想 App 引导流。必须嵌入真实的 iPhone 15 Pro 边框外壳、灵动岛及底部指示条。\n\n设计决策：采用深色琉璃拟态美学（暗夜绿背景搭配磨砂半透明卡片），通过绝对定位层隔离灵动岛与内容区，绑定 GSAP 实现多屏顺滑横移切换。" },
            { type: "tool", content: "[device_frame_embed] 成功挂载 iPhone 15 Pro 拟态外壳与灵动岛交互槽位" },
            { type: "tool", content: "[verifier_check_pass] 无情裁决器审查：触控热区与灵动岛区域无碰撞重叠，多屏过渡逻辑严密" }
        ],
        deliverable: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>AI 冥想 App 移动端引导页</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body { margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#0f172a; font-family:'Montserrat','Noto Sans SC',sans-serif; color:#fff; overflow-y:auto; overflow-x:hidden; padding: 40px 0; box-sizing: border-box; }
        .iphone-frame { width:380px; height:780px; background:#020617; border: 14px solid #1e293b; border-radius:55px; box-shadow: 0 25px 70px rgba(0,0,0,0.8), inset 0 0 15px rgba(255,255,255,0.1); position:relative; overflow:hidden; display:flex; flex-direction:column; }
        .dynamic-island { position:absolute; top:15px; left:50%; transform:translateX(-50%); width:120px; height:35px; background:#000; border-radius:20px; z-index:100; display:flex; align-items:center; justify-content:space-between; padding:0 12px; box-sizing:border-box; }
        .dynamic-island::before { content:''; width:12px; height:12px; background:#10b981; border-radius:50%; box-shadow:0 0 8px #10b981; }
        .dynamic-island::after { content:''; width:12px; height:12px; background:#334155; border-radius:50%; }
        .screen-container { display:flex; width:300%; height:100%; transition:transform 0.5s cubic-bezier(0.16,1,0.3,1); }
        .screen { width:380px; height:100%; padding: 80px 24px 40px; box-sizing:border-box; display:flex; flex-direction:column; justify-content:space-between; align-items:center; background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%); }
        .glass-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 28px 20px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.3); width:100%; box-sizing:border-box; }
        h1 { font-size:1.6rem; margin:0 0 12px; color:#10b981; font-weight:700; }
        p { color:#94a3b8; font-size:0.95rem; line-height:1.6; margin:0; }
        .glow-circle { width:160px; height:160px; border-radius:50%; background:linear-gradient(135deg, #10b981, #06b6d4); display:flex; align-items:center; justify-content:center; font-size:4rem; box-shadow:0 0 40px rgba(16,185,129,0.4); animation:breath 4s infinite ease-in-out; }
        @keyframes breath { 0%,100%{ transform:scale(1); box-shadow:0 0 40px rgba(16,185,129,0.4); } 50%{ transform:scale(1.1); box-shadow:0 0 60px rgba(6,182,212,0.6); } }
        .btn-next { background:linear-gradient(135deg, #10b981, #06b6d4); color:#fff; border:none; padding:16px 36px; border-radius:30px; font-weight:700; font-size:1rem; cursor:pointer; width:100%; box-shadow:0 10px 25px rgba(16,185,129,0.3); transition:all 0.3s; }
        .btn-next:hover { transform:translateY(-2px); box-shadow:0 15px 30px rgba(16,185,129,0.5); }
        .home-indicator { position:absolute; bottom:8px; left:50%; transform:translateX(-50%); width:140px; height:5px; background:#fff; border-radius:10px; z-index:100; }
        .dots { display:flex; gap:8px; margin-bottom:20px; }
        .dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,0.2); transition:all 0.3s; }
        .dot.active { background:#10b981; width:24px; border-radius:4px; }
    </style>
</head>
<body>
    <div class="iphone-frame">
        <div class="dynamic-island"></div>
        <div class="screen-container" id="screens">
            <!-- Screen 1 -->
            <div class="screen">
                <div class="glow-circle" style="margin-top:40px;">🧘</div>
                <div class="glass-card">
                    <h1>量子深吸 (Quantum Breath)</h1>
                    <p>重塑您的神经元节律，通过多模态声学共振释放深度脑波潜能。</p>
                </div>
                <div style="width:100%; display:flex; flex-direction:column; align-items:center;">
                    <div class="dots"><span class="dot active"></span><span class="dot"></span><span class="dot"></span></div>
                    <button class="btn-next" onclick="nextScreen(1)">继续探索</button>
                </div>
            </div>
            <!-- Screen 2 -->
            <div class="screen">
                <div class="glow-circle" style="margin-top:40px; background:linear-gradient(135deg, #3b82f6, #8b5cf6); box-shadow:0 0 40px rgba(139,92,246,0.4);">🌌</div>
                <div class="glass-card">
                    <h1 style="color:#8b5cf6;">全息白噪 (Holo Sound)</h1>
                    <p>直连 OpenDesign 空间音频矩阵，为您实时生成阿尔法沉浸助眠场。</p>
                </div>
                <div style="width:100%; display:flex; flex-direction:column; align-items:center;">
                    <div class="dots"><span class="dot"></span><span class="dot active" style="background:#8b5cf6;"></span><span class="dot"></span></div>
                    <button class="btn-next" style="background:linear-gradient(135deg, #3b82f6, #8b5cf6); box-shadow:0 10px 25px rgba(139,92,246,0.3);" onclick="nextScreen(2)">下一步</button>
                </div>
            </div>
            <!-- Screen 3 -->
            <div class="screen">
                <div class="glow-circle" style="margin-top:40px; background:linear-gradient(135deg, #f59e0b, #ef4444); box-shadow:0 0 40px rgba(245,158,11,0.4);">✨</div>
                <div class="glass-card">
                    <h1 style="color:#f59e0b;">心流合一 (Flow State)</h1>
                    <p>准备就绪，开启属于您的专属 AI 冥想旅程，畅享极致精神宁静。</p>
                </div>
                <div style="width:100%; display:flex; flex-direction:column; align-items:center;">
                    <div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot active" style="background:#f59e0b;"></span></div>
                    <button class="btn-next" style="background:linear-gradient(135deg, #f59e0b, #ef4444); box-shadow:0 10px 25px rgba(245,158,11,0.3);" onclick="alert('✨ 恭喜开启 AI 冥想之旅！')">开启心流</button>
                </div>
            </div>
        </div>
        <div class="home-indicator"></div>
    </div>
    <script>
        function nextScreen(index) {
            document.getElementById('screens').style.transform = 'translateX(-' + (index * 380) + 'px)';
        }
    </script>
</body>
</html>`
    },

    'apple_ppt_demo': {
        title: "Apple 级极简发布会 PPT",
        trace: [
            { type: "tool", content: "[revealjs_engine_load] 载入 Reveal.js 极简幻灯片框架与 DECK_FRAMEWORK_DIRECTIVE 契约" },
            { type: "cot", content: "需求分析：用户请求为‘下一代 AI 智能硬件’生成 5 页路演幻灯片。要求采用深邃琉璃拟态容器，严格利用子 div 包裹防重叠，并嵌入动态生成的渐变插图。\n\n设计规范：严格遵守 Apple 官网与 Linear 的极简深色美学规范，确保每屏留白面积大于 40%，通过显隐隔离契约彻底根除多页文字堆叠碰撞。" },
            { type: "tool", content: "[apple_aesthetic_apply] 应用夜航蓝极简主题 Token 与平滑淡入切换效果" },
            { type: "tool", content: "[verifier_check_pass] 无情裁决器审查：全屏排版间距符合黄金分割，无任何重叠或溢出" }
        ],
        deliverable: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>下一代 AI 智能硬件发布会</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;500;700&family=Noto+Sans+SC:wght@300;500;700&display=swap" rel="stylesheet">
    <style>
        body { margin:0; padding:0; background:#000; font-family:'Montserrat','Noto Sans SC',sans-serif; color:#fff; overflow-y:auto; overflow-x:hidden; }
        .slides-container { width:100vw; min-height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; padding: 60px 20px 140px; box-sizing:border-box; position:relative; }
        .slide { display:none; width:100%; flex-direction:column; justify-content:center; align-items:center; box-sizing:border-box; }
        .slide.active { display:flex; animation: slideFadeIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes slideFadeIn { from { opacity:0; transform:translateY(15px); } to { opacity:1; transform:translateY(0); } }
        .glass-box { background: rgba(255,255,255,0.03); backdrop-filter: blur(30px); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 60px 80px; text-align:center; max-width: 1000px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); width:100%; box-sizing:border-box; }
        h1 { font-size:3.5rem; font-weight:700; letter-spacing:4px; margin:0 0 24px; background:linear-gradient(180deg, #fff 0%, #94a3b8 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        p { font-size:1.4rem; color:#94a3b8; font-weight:300; line-height:1.6; margin:0 0 40px; }
        .gradient-art { width:100%; height:200px; border-radius:16px; background:linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6); margin-bottom:40px; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:700; box-shadow:0 10px 30px rgba(59,130,246,0.3); }
        .nav-bar { position:fixed; bottom:30px; display:flex; gap:20px; z-index:9999; background:rgba(15,23,42,0.85); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1px solid rgba(6,182,212,0.3); padding:10px 24px; border-radius:40px; box-shadow:0 10px 30px rgba(0,0,0,0.6); }
        .nav-btn { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:10px 24px; border-radius:30px; cursor:pointer; font-size:0.95rem; font-weight:600; transition:all 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nav-btn:hover { background:#06b6d4; color:#fff; border-color:#06b6d4; box-shadow:0 0 15px rgba(6,182,212,0.4); transform:translateY(-2px); }
        .page-num { position:absolute; top:40px; right:40px; font-size:1rem; color:#64748b; font-family:monospace; }
    </style>
</head>
<body>
    <div class="slides-container">
        <!-- Slide 1 -->
        <div class="slide active" id="slide-1">
            <div class="page-num">01 / 05</div>
            <div class="glass-box">
                <h1>NEURA ONE</h1>
                <p>下一代 AI 智能硬件。超越现实，重塑感知与交互的极致边界。</p>
                <div class="gradient-art">✨ 颠覆性量子计算核心</div>
            </div>
        </div>
        <!-- Slide 2 -->
        <div class="slide" id="slide-2">
            <div class="page-num">02 / 05</div>
            <div class="glass-box" style="max-width:1200px;">
                <h1>无感交互架构</h1>
                <p>彻底告别繁琐操作。基于意图识别与生物电场感应，让科技隐于无形。</p>
                <div style="display:flex; gap:30px; margin-top:30px;">
                    <div style="flex:1; padding:30px; background:rgba(255,255,255,0.05); border-radius:16px;">
                        <h3 style="color:#06b6d4; font-size:1.5rem; margin:0 0 15px;">0 毫秒延迟</h3>
                        <p style="font-size:1.1rem; margin:0;">全息神经网络直连，所思即所得</p>
                    </div>
                    <div style="flex:1; padding:30px; background:rgba(255,255,255,0.05); border-radius:16px;">
                        <h3 style="color:#10b981; font-size:1.5rem; margin:0 0 15px;">全天候共生</h3>
                        <p style="font-size:1.1rem; margin:0;">超微型常温超导电池，续航突破 30 天</p>
                    </div>
                </div>
            </div>
        </div>
        <!-- Slide 3 -->
        <div class="slide" id="slide-3">
            <div class="page-num">03 / 05</div>
            <div class="glass-box">
                <h1>琉璃拟态美学</h1>
                <p>采用钛合金一体成型边框与微晶玻璃外壳，尽显工业设计的传世艺术。</p>
                <div class="gradient-art" style="background:linear-gradient(135deg, #10b981, #06b6d4);">💎 极致纯粹的极致质感</div>
            </div>
        </div>
        <!-- Slide 4 -->
        <div class="slide" id="slide-4">
            <div class="page-num">04 / 05</div>
            <div class="glass-box">
                <h1>隐私与安全护城河</h1>
                <p>硬件级加密芯片，本地闭环计算，您的所有记忆与灵感绝对不予外流。</p>
                <div class="gradient-art" style="background:linear-gradient(135deg, #f59e0b, #ef4444);">🔒 军工级数据安全承诺</div>
            </div>
        </div>
        <!-- Slide 5 -->
        <div class="slide" id="slide-5">
            <div class="page-num">05 / 05</div>
            <div class="glass-box">
                <h1>开启未来时代</h1>
                <p>即日起开启全球首发预定。与我们一同见证 AI 硬件的伟大历史转折。</p>
                <button class="nav-btn" style="background:#fff; color:#000; font-weight:700; padding:16px 40px; font-size:1.2rem;" onclick="alert('✨ 感谢预定 NEURA ONE！')">立即预定 ($999)</button>
            </div>
        </div>
        <div class="nav-bar">
            <button class="nav-btn" onclick="changeSlide(-1)">上一页</button>
            <button class="nav-btn" onclick="changeSlide(1)">下一页</button>
        </div>
    </div>
    <script>
        let current = 1;
        function changeSlide(dir) {
            document.getElementById('slide-' + current).classList.remove('active');
            current += dir;
            if (current < 1) current = 5;
            if (current > 5) current = 1;
            document.getElementById('slide-' + current).classList.add('active');
        }
    </script>
</body>
</html>`
    },

    'prd_whitepaper_demo': {
        title: "第一性原理产品架构 PRD 白皮书",
        trace: [
            { type: "tool", content: "[pm_spec_parser] 深度对接 pm-spec 与 eng-runbook 规范，启动第一性原理架构拆解" },
            { type: "cot", content: "需求分析：用户请求起草关于‘龙虾多智能体编排操作系统’的深度架构 PRD 白皮书，包含完整的模块拆解表与mermaid时序图。\n\n执行策略：按照高管汇报出版级标准，总督阁下统筹全局模块定义，技术参谋梳理多智能体消息总线引擎与隔离沙盒机制，并利用 Mermaid 渲染出多层级协同交互时序图。" },
            { type: "tool", content: "[mermaid_engine_render] 成功渲染底层通信时序图与模块决策树" },
            { type: "tool", content: "[verifier_check_pass] 无情裁决器审查：技术名词表述严谨，模块拆解颗粒度符合第一性原理标准" }
        ],
        deliverable: `# 龙虾多智能体编排操作系统 (Lobster OS) 深度架构 PRD 白皮书

> **文档版本**: v2.0-Production | **密级**: 核心高管内部绝密汇报 | **编写团队**: 龙虾特战队架构组

---

## 1. 第一性原理与系统愿景 (First Principles & Vision)

在当前大模型爆发的时代，单点 Prompt 工程已触及能力的物理天花板。**Lobster OS** 的设计哲学源于第一性原理：**将复杂开放式任务降维拆解为高度自治、职责明确的专家智能体网络**，通过底层强力的消息总线（Message Bus）与无情裁决器（Verifier）的协同阻断机制，彻底根除幻觉与格式失控，实现生产级跨模态交付。

---

## 2. 系统核心架构图 (System Architecture)

\`\`\`mermaid
graph TD
    User[👤 业务指挥官] -->|自然语言指令| API[⚡ FastAPI 异步网关]
    API --> Gov[🏛️ 总督阁下 / 战术参谋]
    
    subgraph 专家智能体协作网络 (Expert Squads)
        Gov -->|分发拆解任务| Coder[💻 全栈主理人]
        Gov -->|调度审美契约| UIUX[✨ UIUX 参谋]
        Gov -->|出海与合规| Global[🌍 跨境出海参谋]
    end
    
    Coder --> Bus[🛰️ 龙虾高速消息总线]
    UIUX --> Bus
    Global --> Bus
    
    Bus --> Verifier[⚖️ 无情裁决器官邸]
    Verifier -->|防重叠/隔离未达标| Bus
    Verifier -->|审查通过放行| Delivery[📦 最终成果沙盒交付物]
\`\`\`

---

## 3. 核心功能模块拆解表 (Module Breakdown Matrix)

| 模块代号 | 模块名称 | 核心职责与第一性原理定义 | 依赖底层工具链 | 交付物规约 |
| :--- | :--- | :--- | :--- | :--- |
| **SYS-01** | **Orchestration Engine** | 全局异步编排引擎，维护单例事件循环与多模态上下文 | \`asyncio\`, \`EngineBus\` | 实时 WebSocket 追踪流 |
| **SYS-02** | **Expert Squad Matrix** | 13大垂直领域专家网络，深度解耦业务逻辑与代码实现 | \`opendesign_skills\` | 高保真 Markdown / HTML |
| **SYS-03** | **Verifier Citadel** | 无情裁决器官邸，执行显隐隔离契约与防碰撞审查 | \`DECK_DIRECTIVE\` | 事实核查阻断报告 |
| **SYS-04** | **Live Sandbox Preview** | 独立沙盒沙盘预览，提供双模态切换与全屏沉浸展示 | \`iframe_sandbox\` | 生产级可视化界面 |

---

## 4. 多智能体协作交互时序图 (Collaboration Sequence)

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor 指挥官 as 👤 业务指挥官
    participant 总督 as 🏛️ 总督阁下
    participant 专家 as 💻 全栈/UIUX专家团
    participant 裁决 as ⚖️ 无情裁决器
    participant 沙盒 as 🌐 独立沙盒预览

    指挥官->>总督: 下达大白话业务需求 (如：制作拟态引导页)
    总督->>总督: 第一性原理需求分析与任务拆解
    总督->>专家: 分派子领域开发任务与审美契约 (mobile-onboarding)
    专家->>专家: 调度底层沙盒工具 (生图/代码编写)
    专家->>裁决: 提交初版 DOM 树与多媒体资源包
    裁决->>裁决: 执行防重叠与排版显隐层严格审查
    alt 发现排版重叠或溢出
        裁决-->>专家: 驳回并附带修正指令 (要求修改定位层级)
        专家->>裁决: 重新提交修正后的代码
    end
    裁决->>沙盒: 审查通过，推送至前端沙盒引擎
    沙盒-->>指挥官: 呈现高保真琉璃拟态可视化页面
\`\`\`

---

## 5. 商业化与演进路线图 (Roadmap & ROI)

*   **Phase 1 (已完成)**: 全面打通 OpenDesign 31 种核心技能与豆包旗舰生图管线，实现单会话闭环。
*   **Phase 2 (当前进行)**: 示例玩法大厅上线，大幅降低高管与业务人员上手门槛，ROI 预计提升 300%。
*   **Phase 3 (未来展望)**: 引入跨节点分布式智能体集群，支持超大型企业级 SaaS 矩阵一键生成。`
    },

    'saas_landing_demo': {
        title: "SaaS 独立产品展示与定价页",
        trace: [
            { type: "tool", content: "[vercel_framer_style] 提取 Vercel 与 Framer 现代科技感排版 Token" },
            { type: "cot", content: "需求分析：用户请求设计带完整定价卡片对比、FAQ 折叠面板的 SaaS 产品落地页单文件应用。配色采用高级夜航蓝底色搭配青色微光强调色。\n\n技术实现：全栈主理人使用 Flex 布局构建响应式三栏定价对比卡片，通过 CSS 伪类与平滑过渡实现手风琴 FAQ 折叠面板，并注入夜航蓝极简科技美学。" },
            { type: "tool", content: "[pricing_matrix_build] 成功构建三档阶梯定价卡片与微光边框" },
            { type: "tool", content: "[verifier_check_pass] 无情裁决器审查：各套餐权益对比表述清晰，无排版错位" }
        ],
        deliverable: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>NEXUS AI - 新一代 SaaS 产品落地页</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body { margin:0; padding:0; background:#0b0f19; font-family:'Inter','Noto Sans SC',sans-serif; color:#f8fafc; overflow-y:auto; overflow-x:hidden; }
        header { border-bottom:1px solid rgba(6,182,212,0.2); padding:20px 60px; display:flex; justify-content:space-between; align-items:center; background:rgba(11,15,25,0.8); backdrop-filter:blur(12px); position:fixed; top:0; left:0; width:100%; box-sizing:border-box; z-index:100; }
        .logo { font-size:1.5rem; font-weight:900; color:#fff; display:flex; align-items:center; gap:10px; }
        .logo span { color:#06b6d4; }
        .hero { padding:160px 20px 80px; text-align:center; max-width:1000px; margin:0 auto; }
        h1 { font-size:4rem; font-weight:900; letter-spacing:-1px; margin:0 0 24px; line-height:1.1; background:linear-gradient(135deg, #fff 0%, #06b6d4 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .hero p { font-size:1.4rem; color:#94a3b8; margin:0 0 40px; line-height:1.6; }
        .cta-btn { background:linear-gradient(135deg, #06b6d4, #3b82f6); color:#fff; border:none; padding:18px 42px; border-radius:30px; font-weight:700; font-size:1.1rem; cursor:pointer; box-shadow:0 10px 30px rgba(6,182,212,0.3); transition:all 0.3s; }
        .cta-btn:hover { transform:translateY(-2px); box-shadow:0 15px 40px rgba(6,182,212,0.5); }
        .pricing-section { padding:80px 40px; max-width:1400px; margin:0 auto; }
        .section-title { text-align:center; font-size:2.5rem; font-weight:800; margin-bottom:60px; color:#fff; }
        .pricing-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(350px, 1fr)); gap:30px; }
        .price-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:24px; padding:40px; display:flex; flex-direction:column; justify-content:space-between; transition:all 0.3s; position:relative; overflow:hidden; }
        .price-card:hover { border-color:#06b6d4; transform:translateY(-5px); box-shadow:0 20px 40px rgba(6,182,212,0.2); background:rgba(255,255,255,0.05); }
        .popular-badge { position:absolute; top:20px; right:20px; background:linear-gradient(135deg, #06b6d4, #3b82f6); color:#fff; font-size:0.8rem; font-weight:700; padding:6px 16px; border-radius:20px; }
        .price { font-size:3.5rem; font-weight:900; color:#fff; margin:20px 0; }
        .price span { font-size:1.2rem; color:#94a3b8; font-weight:500; }
        .feature-list { list-style:none; padding:0; margin:0 0 40px; display:flex; flex-direction:column; gap:16px; }
        .feature-list li { display:flex; align-items:center; gap:12px; color:#cbd5e1; font-size:1.05rem; }
        .faq-section { padding:80px 40px 140px; max-width:900px; margin:0 auto; }
        .faq-item { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:16px; margin-bottom:20px; overflow:hidden; transition:all 0.3s; }
        .faq-header { padding:24px; font-size:1.2rem; font-weight:700; color:#fff; display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
        .faq-body { padding:0 24px 24px; color:#94a3b8; font-size:1.05rem; line-height:1.6; display:none; }
        .faq-item.open { border-color:#06b6d4; background:rgba(6,182,212,0.05); }
        .faq-item.open .faq-body { display:block; }
    </style>
</head>
<body>
    <header>
        <div class="logo">🦞 LOBSTER <span>SaaS</span></div>
        <button class="cta-btn" style="padding:12px 28px; font-size:1rem;" onclick="alert('✨ 欢迎登录工作台')">立即登录</button>
    </header>
    <div class="hero">
        <h1>新一代多智能体 SaaS 矩阵</h1>
        <p>一键调度底层专家团，十倍速提升企业级跨模态内容生产与研发效能。</p>
        <button class="cta-btn" onclick="document.getElementById('pricing').scrollIntoView({behavior:'smooth'})">查看定价方案</button>
    </div>
    <div class="pricing-section" id="pricing">
        <div class="section-title">简单透明的阶梯定价</div>
        <div class="pricing-grid">
            <!-- Card 1 -->
            <div class="price-card">
                <div>
                    <h3 style="font-size:1.5rem; margin:0; color:#94a3b8;">探索版 (Starter)</h3>
                    <div class="price">¥0 <span>/ 永久免费</span></div>
                    <ul class="feature-list">
                        <li>✅ 访问基础 5 大领域专家参谋</li>
                        <li>✅ 每月 100 次沙盒生成推演</li>
                        <li>✅ 社区版公共知识库支持</li>
                    </ul>
                </div>
                <button class="cta-btn" style="background:rgba(255,255,255,0.1); box-shadow:none;" onclick="alert('✨ 已开启免费探索')">免费开始</button>
            </div>
            <!-- Card 2 -->
            <div class="price-card" style="border-color:#06b6d4; background:rgba(6,182,212,0.05);">
                <div class="popular-badge">强烈推荐</div>
                <div>
                    <h3 style="font-size:1.5rem; margin:0; color:#06b6d4;">专业版 (Pro)</h3>
                    <div class="price">¥399 <span>/ 月</span></div>
                    <ul class="feature-list">
                        <li>✅ 全量解锁 13 大垂直领域专家</li>
                        <li>✅ 无限次沙盒推演与多媒体生成</li>
                        <li>✅ 专属无情裁决器显隐隔离审查</li>
                        <li>✅ 7x24 小时高管级技术支持</li>
                    </ul>
                </div>
                <button class="cta-btn" onclick="alert('✨ 感谢订阅专业版！')">立即订阅专业版</button>
            </div>
            <!-- Card 3 -->
            <div class="price-card">
                <div>
                    <h3 style="font-size:1.5rem; margin:0; color:#94a3b8;">企业版 (Enterprise)</h3>
                    <div class="price">¥1,999 <span>/ 月</span></div>
                    <ul class="feature-list">
                        <li>✅ 独立物理集群与私有化部署</li>
                        <li>✅ 自定义企业级审批流与知识库</li>
                        <li>✅ 专家智能体深度微调与契约挂载</li>
                        <li>✅ 专属客户成功经理驻场服务</li>
                    </ul>
                </div>
                <button class="cta-btn" style="background:rgba(255,255,255,0.1); box-shadow:none;" onclick="alert('✨ 正在为您转接大客户经理')">联系销售</button>
            </div>
        </div>
    </div>
    <div class="faq-section">
        <div class="section-title" style="margin-bottom:40px;">常见问题解答 (FAQ)</div>
        <div class="faq-item" onclick="this.classList.toggle('open')">
            <div class="faq-header"><span>Q: 龙虾 SaaS 矩阵生成的内容支持商用吗？</span><span>➕</span></div>
            <div class="faq-body">A: 完全支持。我们底层调用的所有模型配图与代码产物均遵循商用开源协议，您可以直接将其应用于您的商业项目与高管汇报中。</div>
        </div>
        <div class="faq-item" onclick="this.classList.toggle('open')">
            <div class="faq-header"><span>Q: 如何保证生成产物不会出现文字重叠或报错？</span><span>➕</span></div>
            <div class="faq-body">A: 系统内置了强力的“无情裁决器 (Verifier)”，在交付前会自动执行严格的 DOM 结构审查与排版显隐层隔离测试，彻底杜绝重叠碰撞问题。</div>
        </div>
        <div class="faq-item" onclick="this.classList.toggle('open')">
            <div class="faq-header"><span>Q: 支持退款或随时取消订阅吗？</span><span>➕</span></div>
            <div class="faq-body">A: 支持。您可以随时在控制台管理您的订阅计划，取消后次月将不再扣费。</div>
        </div>
    </div>
</body>
</html>`
    },

    'heygen_motion_demo': {
        title: "HeyGen 级品牌揭示动态图形单页",
        trace: [
            { type: "tool", content: "[hyperframes_dispatch] 调度 HyperFrames 动效管线，载入 logo-outro 分镜契约" },
            { type: "cot", content: "需求分析：用户请求完全基于 HTML+CSS+GSAP 的高能品牌揭示动画单页，展现从数据粒子汇聚到发光 Logo 的极致动效。\n\n实现细节：技术参谋利用 HTML5 Canvas 绘制 500 个高速旋转的星河粒子，通过 GSAP 时间轴控制粒子的向心汇聚与极速扩散，最后配合炫酷耀斑背景定格展示高亮的品牌 Logo。" },
            { type: "tool", content: "[gsap_timeline_create] 成功编排星河粒子汇聚与耀斑爆发动效时间轴" },
            { type: "tool", content: "[verifier_check_pass] 无情裁决器审查：动效帧率稳定在 60FPS，无任何内存泄露或卡顿" }
        ],
        deliverable: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>HeyGen 级品牌揭示动效单页</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap" rel="stylesheet">
    <style>
        body { margin:0; padding:0; background:#000; overflow:hidden; display:flex; justify-content:center; align-items:center; height:100vh; font-family:'Montserrat',sans-serif; }
        canvas { position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; }
        .logo-container { position:relative; z-index:2; text-align:center; opacity:0; transform:scale(0.5); animation:revealLogo 3s 1.5s cubic-bezier(0.16,1,0.3,1) forwards; }
        .logo-icon { font-size:7rem; margin-bottom:20px; filter:drop-shadow(0 0 30px #06b6d4); animation:float 3s infinite ease-in-out; }
        @keyframes float { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-15px); filter:drop-shadow(0 0 50px #10b981); } }
        .logo-text { font-size:5rem; font-weight:900; color:#fff; letter-spacing:10px; background:linear-gradient(135deg, #fff 0%, #06b6d4 50%, #10b981 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; filter:drop-shadow(0 0 20px rgba(6,182,212,0.4)); }
        .slogan { font-size:1.5rem; color:#94a3b8; letter-spacing:8px; margin-top:15px; text-transform:uppercase; }
        @keyframes revealLogo { from { opacity:0; transform:scale(0.5); } to { opacity:1; transform:scale(1); } }
        .flare { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:200vw; height:200vw; background:radial-gradient(circle, rgba(6,182,212,0.4) 0%, rgba(0,0,0,0) 70%); z-index:1; opacity:0; animation:flareExplode 2s 1.2s cubic-bezier(0.16,1,0.3,1) forwards; pointer-events:none; }
        @keyframes flareExplode { 0% { opacity:0; transform:translate(-50%,-50%) scale(0); } 50% { opacity:1; transform:translate(-50%,-50%) scale(1); } 100% { opacity:0.5; transform:translate(-50%,-50%) scale(1.2); } }
    </style>
</head>
<body>
    <div class="flare"></div>
    <canvas id="particleCanvas"></canvas>
    <div class="logo-container">
        <div class="logo-icon">🦞</div>
        <div class="logo-text">LOBSTER OS</div>
        <div class="slogan">Next-Gen Multi-Agent Network</div>
    </div>
    <script>
        const canvas = document.getElementById('particleCanvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        const particles = [];
        for(let i=0; i<400; i++){
            particles.push({
                x: canvas.width/2 + (Math.random()-0.5)*2000,
                y: canvas.height/2 + (Math.random()-0.5)*2000,
                radius: Math.random()*3+1,
                color: Math.random() > 0.5 ? '#06b6d4' : '#10b981',
                speed: Math.random()*8 + 4,
                angle: Math.random()*Math.PI*2
            });
        }
        function animate(){
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                const dx = canvas.width/2 - p.x; const dy = canvas.height/2 - p.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if(dist > 50){ p.x += (dx/dist)*p.speed + (Math.random()-0.5)*4; p.y += (dy/dist)*p.speed + (Math.random()-0.5)*4; }
                else { p.x = canvas.width/2 + (Math.random()-0.5)*2000; p.y = canvas.height/2 + (Math.random()-0.5)*2000; }
                ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2); ctx.fillStyle = p.color; ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fill();
            });
            requestAnimationFrame(animate);
        }
        animate();
        window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
    </script>
</body>
</html>`
    },

    'global_matrix_demo': {
        title: "跨国出海本地化多语言推广矩阵",
        trace: [
            { type: "tool", content: "[cultural_taboo_scan] 调度出海参谋，扫描欧美与东南亚市场文化禁忌与合规风险" },
            { type: "cot", content: "需求分析：用户请求制定针对欧美与东南亚市场的 AI 效率工具本地化推广方案及多国文化禁忌审查表。\n\n执行策略：出海参谋完成多国本地化传播矩阵与增长黑客裂变策略梳理，法务参谋完成 GDPR 与跨国数据合规性审查，最终交付多维合规决策表与营销矩阵研报。" },
            { type: "tool", content: "[localization_matrix] 成功构建多语种本地化传播矩阵与增长黑客裂变策略" },
            { type: "tool", content: "[verifier_check_pass] 无情裁决器审查：所有出海营销术语符合当地法律法规，无任何文化禁忌违规" }
        ],
        deliverable: `# AI 效率工具全球化出海本地化推广方案与文化禁忌审查表

> **文档密级**: 核心出海战略部署 | **目标市场**: 北美、欧盟、东南亚 (新马泰/印尼) | **评估团队**: 龙虾出海特战队

---

## 1. 全球市场准入与文化禁忌审查表 (Cultural Taboos & Compliance)

在跨国营销中，触犯当地文化禁忌或合规条例将带来毁灭性打击。以下为各核心目标市场的深度排查清单：

| 目标区域 | 核心合规条例与法规 | 视觉与文化禁忌事项 | 本地化营销沟通建议 |
| :--- | :--- | :--- | :--- |
| **北美 (美/加)** | **CCPA / COPPA / FTC 广告法** | 严禁涉及种族、性别歧视暗示；避免使用过于绝对的夸大词汇（如 Best、100% Guaranteed） | 强调“个人生产力提效”、“ROI 证明”与“极简工作流”；采用直截了当的职场痛点切入。 |
| **欧盟 (EU)** | **GDPR (极其严格的隐私条例)** | 严禁未经明确授权收集 Cookie 与个人生物识别数据；避免涉及政治争议元素 | 突出“本地闭环计算”、“企业级数据加密护城河”与“符合欧盟数据主权”；提供透明的白皮书。 |
| **东南亚 (新马泰)**| **PDPA / 各国本地宗教法** | 泰国严禁调侃王室；印尼/马来西亚需严格避开不合规的清真禁忌与暴露视觉元素 | 突出“超高性价比”、“移动端便捷操作”与“社群互助裂变”；采用色彩明快、接地气的海报。 |

---

## 2. 多语言本地化传播与增长矩阵 (Localization Campaign Matrix)

\`\`\`mermaid
graph LR
    HQ[🚀 龙虾出海总部中枢] --> NA[🇺🇸 北美市场组]
    HQ --> EU[🇪🇺 欧盟市场组]
    HQ --> SEA[🇸🇬 东南亚市场组]

    NA -->|LinkedIn / Twitter| N1[重点宣传：AI 替代繁琐工作流，提升 10 倍职场竞争力]
    EU -->|TechCrunch / PRWeb| E1[重点宣传：GDPR 绝对合规，企业级私有化部署首选]
    SEA -->|TikTok / Facebook| S1[重点宣传：KOL 开箱测评，移动端秒级生成排版大片]
\`\`\`

---

## 3. 核心增长黑客裂变策略 (Growth Hacker Tactics)

### 策略一：基于本地化模板库的 PLG (Product-Led Growth) 增长
针对不同国家用户习惯，内置定制化的多媒体模板（例如欧美喜好极简深色卡片，东南亚喜好鲜艳活泼的动效单页）。用户生成后带有 \`Powered by Lobster OS\` 水印，分享至社交媒体即可解锁专业版额度。

### 策略二：跨国 KOL 分级矩阵共创
*   **头部 Tech KOL (YouTube/Twitter)**：主打深度硬核的技术架构剖析与多智能体协作防重叠评测。
*   **中腰部职场干货博主 (TikTok/Instagram)**：主打“3分钟搞定一周工作量”的场景化短视频演示。

---

## 4. 风险控制与应急响应决策树 (Risk Management)

\`\`\`mermaid
graph TD
    Alert[⚠️ 突发海外公关或合规预警] --> Check{是否涉及 GDPR 或用户隐私违规?}
    Check -->|是| Lock[🔒 紧急切断对应区域数据同步，启动法务隔离合规审查]
    Check -->|否| PR{是否涉及文化或宗教争议?}
    PR -->|是| Down[撤下争议素材，公关参谋单点直通发布诚恳致歉与整改说明]
    PR -->|否| Monitor[📊 持续监控舆情走势，战术参谋每小时生成分析简报]
\`\`\`

---

## 5. 总结与执行批示 (Executive Summary)
出海行动即刻启动。各战区负责人需严格按照上述禁忌审查表对所有物料进行二次核验，确保龙虾多模态生态在全球市场的顺畅落地与爆发增长。`
    }
};

// 一键载入示例玩法剧本回调函数 (仅跳转战术编排工作台并填入提示词/剧本，不加载产物/推演)
window.applyShowcase = function(workflowId, promptText) {
    // 1. 切换回战术编排工作台
    switchView(navStudioBtn, studioView);
    
    // 2. 选中“固定剧本编排”模式选项卡
    const workflowTab = document.querySelector('.engine-tab[data-mode="workflow"]');
    if (workflowTab) {
        engineTabs.forEach(t => t.classList.remove('active'));
        workflowTab.classList.add('active');
        modeViewWorkflow.classList.add('active');
        modeViewWorkflow.classList.remove('hidden');
        modeViewGeneral.classList.remove('active');
        modeViewGeneral.classList.add('hidden');
    }
    
    // 3. 设置具体的剧本选择器
    if (workflowSelect) {
        workflowSelect.value = workflowId;
        workflowSelect.dispatchEvent(new Event('change'));
    }
    
    // 4. 填入提示词
    if (promptInput) {
        promptInput.value = promptText;
        promptInput.focus();
        promptInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    showToast('✨ 已为您载入专属高能剧本与提示词配置，点击下方按钮即可启动！');
};

// 在当前大厅界面内查看演示详情 (展现专家推演过程与高保真沙盒产物预览)
window.viewShowcaseDetail = function(demoKey, workflowId, promptText) {
    const listPanel = document.getElementById('showcase-list-panel');
    const detailPanel = document.getElementById('showcase-detail-panel');
    if (!listPanel || !detailPanel) return;

    const demo = showcaseDemoData[demoKey];
    if (!demo) return;

    // 切换面板显隐
    listPanel.classList.add('hidden');
    detailPanel.classList.remove('hidden');

    // 更新详情页头部标题与描述
    const titleEl = document.getElementById('showcase-detail-title');
    if (titleEl) titleEl.textContent = demo.title;

    // 绑定“载入该剧本去战术台”按钮的事件
    const loadBtn = document.getElementById('showcase-load-btn');
    if (loadBtn) {
        loadBtn.onclick = function() {
            window.applyShowcase(workflowId, promptText);
        };
    }

    // 渲染左栏 Trace Feed
    const traceBody = document.getElementById('showcase-trace-body');
    if (traceBody) {
        traceBody.innerHTML = `<div style="margin-bottom: 1rem; padding: 0.8rem 1.2rem; background: rgba(16,185,129,0.15); border: 1px solid #10b981; border-radius: 8px; color: #10b981; font-weight: 700;">✨ 正在为您展现【${demo.title}】的生产级高保真推演过程：</div>`;
        
        demo.trace.forEach((t, i) => {
            const item = document.createElement('div');
            item.style.cssText = `margin-bottom: 1rem; padding: 1rem 1.2rem; border-radius: 8px; background: rgba(0,0,0,0.4); border: 1px solid rgba(6,182,212,0.2); animation: viewFadeIn 0.4s ease ${i * 0.15}s backwards;`;
            
            if (t.type === 'tool') {
                item.style.borderLeft = '4px solid #06b6d4';
                item.innerHTML = `<div style="font-size:0.85rem; color:#06b6d4; font-weight:700; margin-bottom:0.4rem;">⚙️ 底层沙盒与工具链调度</div><div style="font-family:monospace; color:#38bdf8;">${escapeHtml(t.content)}</div>`;
            } else {
                item.style.borderLeft = '4px solid #10b981';
                item.innerHTML = `<div style="font-size:0.85rem; color:#10b981; font-weight:700; margin-bottom:0.4rem;">🧠 专家思考链路与推演决策</div><div style="color:#cbd5e1; line-height:1.6; white-space:pre-wrap;">${escapeHtml(t.content)}</div>`;
            }
            traceBody.appendChild(item);
        });
    }

    // 渲染右栏 Deliverable Preview
    const iframeEl = document.getElementById('showcase-preview-iframe');
    const mdBodyEl = document.getElementById('showcase-markdown-body');
    if (!iframeEl || !mdBodyEl) return;

    const isWebProduct = demo.deliverable.includes('<!DOCTYPE html>');
    if (isWebProduct) {
        iframeEl.style.display = 'block';
        mdBodyEl.style.display = 'none';
        
        iframeEl.srcdoc = demo.deliverable;
    } else {
        iframeEl.style.display = 'none';
        mdBodyEl.style.display = 'block';
        
        if (window.marked) {
            mdBodyEl.innerHTML = window.marked.parse(demo.deliverable);
        } else {
            mdBodyEl.textContent = demo.deliverable;
        }
    }
};

window.closeShowcaseDetail = function() {
    const listPanel = document.getElementById('showcase-list-panel');
    const detailPanel = document.getElementById('showcase-detail-panel');
    if (!listPanel || !detailPanel) return;

    detailPanel.classList.add('hidden');
    listPanel.classList.remove('hidden');
    
    // 清空 iframe 内容防止背景音乐或动效继续运行
    const iframeEl = document.getElementById('showcase-preview-iframe');
    if (iframeEl) iframeEl.srcdoc = '';

    // 恢复最大化状态
    const panel = document.getElementById('showcase-preview-panel');
    if (panel && panel.classList.contains('maximized')) {
        window.toggleShowcaseMaximize();
    }
};

window.toggleShowcaseMaximize = function() {
    const panel = document.getElementById('showcase-preview-panel');
    const btn = document.getElementById('showcase-toggle-maximize-btn');
    if (!panel || !btn) return;

    const isMaximized = panel.classList.contains('maximized');
    if (!isMaximized) {
        // 动态越狱：直接挂载到 body 下，彻底解决父级 backdrop-filter 产生的 containing block 导致的 absolute/fixed 元素被 overflow:hidden 强行截断的 CSS 顽疾！
        panel.classList.add('maximized');
        document.body.appendChild(panel);
        
        btn.textContent = '🗗 还原';
        btn.style.borderColor = '#10b981';
        btn.style.color = '#10b981';
        showToast('📺 产物预览已最大化全屏展示');
    } else {
        // 还原归位：重新将面板挂载回详情页面的双栏网格中
        panel.classList.remove('maximized');
        const grid = document.getElementById('showcase-detail-grid');
        if (grid) {
            grid.appendChild(panel);
        }
        
        btn.textContent = '🔲 最大化';
        btn.style.borderColor = 'rgba(6,182,212,0.4)';
        btn.style.color = '#06b6d4';
        showToast('📺 产物预览已恢复分栏展示');
    }
};

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
                
                let cleanTitle = item.preview ? item.preview.replace(/\.\.\.$/, '').trim() : '未命名协同探索专案';
                if (cleanTitle.length > 32) cleanTitle = cleanTitle.substring(0, 32) + '...';

                card.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:0.6rem; margin-bottom:0.8rem;">
                        <span style="font-weight:700; color:#06b6d4; font-size:1.1rem; line-height:1.4; display:flex; align-items:flex-start; gap:0.5rem; word-break:break-all; white-space:normal;">
                            <span style="font-size:1.2rem; margin-top:2px;">${item.session_id.includes('workbuddy') ? '🔥' : '⚡'}</span>
                            <span>${escapeHtml(cleanTitle)}</span>
                        </span>
                        <div style="display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">
                            <span style="font-size:0.75rem; color:#38bdf8; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); padding:0.2rem 0.6rem; border-radius:12px; font-family:monospace;">ID: ${item.session_id}</span>
                            <span style="font-size:0.75rem; color:#94a3b8; background: rgba(255,255,255,0.05); padding:0.2rem 0.6rem; border-radius:12px;">${new Date(item.created_at).toLocaleString()}</span>
                        </div>
                    </div>
                    <p style="font-size:0.88rem; color:#cbd5e1; margin:0; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-family: 'Noto Sans SC', sans-serif;">
                        ${escapeHtml(item.preview)}
                    </p>
                `;
                card.onmouseover = () => { if (currentSessionId !== item.session_id) { card.style.borderColor = '#10b981'; card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 8px 24px rgba(16,185,129,0.2)'; } };
                card.onmouseout = () => { if (currentSessionId !== item.session_id) { card.style.borderColor = 'rgba(6,182,212,0.2)'; card.style.transform = 'none'; card.style.boxShadow = 'none'; } };
                card.onclick = () => {
                    document.querySelectorAll('.history-card').forEach(c => { c.style.borderColor = 'rgba(6,182,212,0.2)'; c.style.background = 'rgba(0,0,0,0.5)'; c.style.boxShadow = 'none'; });
                    card.style.borderColor = '#10b981'; card.style.background = 'rgba(16,185,129,0.1)'; card.style.boxShadow = '0 0 20px rgba(16,185,129,0.3)';
                    loadTaskDetail(item.session_id, cleanTitle);
                };
                listContainer.appendChild(card);
            });
            // 默认加载第一条记录
            const firstCard = listContainer.querySelector('.history-card');
            if (firstCard) firstCard.click();
        } else {
            listContainer.innerHTML = '<div class="empty-state"><p>暂无任何过往测试与调研记录</p></div>';
        }
    } catch (e) {
        listContainer.innerHTML = `<div class="empty-state"><p style="color:#f43f5e;">拉取记录失败: ${e.message}</p></div>`;
    }
}

async function loadTaskDetail(sessionId, sessionTitle = "") {
    currentSessionId = sessionId;
    const traceTitleEl = document.getElementById('history-trace-title');
    const traceBodyEl = document.getElementById('history-trace-body');
    const deliveryBodyEl = document.getElementById('history-delivery-body');
    if (!traceBodyEl || !deliveryBodyEl) return;
    
    const displayTitle = sessionTitle || sessionId;
    if (traceTitleEl) traceTitleEl.innerHTML = `<span style="color:#06b6d4;">专家推演监控:</span> ${escapeHtml(displayTitle)}`;
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

                    // 如果文本中包含大段网页或 PPT 源码 (```html)，为了保持中间监控栏清爽，自动折叠显示说明
                    if (cotText.includes('```html')) {
                        cotText = cotText.replace(/```html[\s\S]*?```/gi, '\n\n<div style="background:rgba(6,182,212,0.1); border:1px solid #06b6d4; padding:0.8rem 1.2rem; border-radius:8px; color:#06b6d4; font-weight:600; margin:1rem 0;">✨ 网页/PPT 完整源码已自动折叠，请在右侧独立沙盒实时预览或全屏查看</div>\n\n');
                    } else if (cotText.includes('<!DOCTYPE html>')) {
                        cotText = '<div style="background:rgba(6,182,212,0.1); border:1px solid #06b6d4; padding:0.8rem 1.2rem; border-radius:8px; color:#06b6d4; font-weight:600; margin:1rem 0;">✨ 网页/PPT 完整源码已自动折叠，请在右侧独立沙盒实时预览或全屏查看</div>';
                    }

                    // 如果该消息主体包含 HTML 代码块，则清理掉代码块及周围的保存说明文字，避免在右侧栏重复显示冗余文本
                    if (markdownPart.includes('```html')) {
                        markdownPart = markdownPart.replace(/[^]*?```html[\s\S]*?```/gi, '');
                    } else if (markdownPart.includes('<!DOCTYPE html>')) {
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
                        if (markdownPart.includes('# 📦 终极调研产物')) {
                            finalMarkdownContent = `${markdownPart.substring(markdownPart.indexOf('# 📦 终极调研产物'))}\n\n`;
                        } else {
                            finalMarkdownContent += `${markdownPart}\n\n`;
                        }
                    }
                    if (isFinalReport) {
                        // 动态提取文件名
                        const fileNameMatch = textContent.match(/[\w.-]+\.(?:md|html|json|py)/) || ['ai-agent-research-report.md'];
                        finalArtifactCardHtml = `
                            <div class="custom-artifact-card" style="background: linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(16,185,129,0.1) 100%); border: 1px solid #06b6d4; border-radius: 12px; padding: 1.5rem; margin-top: 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 32px rgba(6,182,212,0.2);">
                                <div style="display:flex; align-items:center; gap:1rem;">
                                    <span style="font-size:2.5rem;">📦</span>
                                    <div>
                                        <div style="font-size:1.1rem; font-weight:700; color:#06b6d4;">任务产生制品 (Deliverables & Attachments)</div>
                                        <div style="font-size:0.85rem; color:#94a3b8; margin-top:0.2rem;">包含智能体深度推演生成的专属产物包及源文件</div>
                                        <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
                                            <span style="background:rgba(6,182,212,0.2); color:#06b6d4; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.8rem; font-weight:600;">${fileNameMatch[0]}</span>
                                            <span style="background:rgba(16,185,129,0.2); color:#10b981; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.8rem; font-weight:600;">文件变更就绪</span>
                                        </div>
                                    </div>
                                </div>
                                <div style="display:flex; gap:1rem;">
                                    <button class="gradient-button" onclick="window.open('${API_BASE}/file/download?path=' + encodeURIComponent('${fileNameMatch[0]}'))" style="padding: 0.8rem 1.5rem; background: linear-gradient(135deg, #10b981, #06b6d4);"><span class="btn-text">直接下载单文件</span><span class="btn-glow"></span></button>
                                    <button class="gradient-button" onclick="downloadReport('${sessionId}')" style="padding: 0.8rem 1.5rem;"><span class="btn-text">下载完整产物包</span><span class="btn-glow"></span></button>
                                </div>
                            </div>
                        `;
                    }
                }
            });

            // 全局遍历该会话的所有历史消息，检索是否出现过 .html 文件路径或大段 HTML 源码
            let htmlPathMatch = null;
            let rawHtmlBlockContent = null;
            data.messages.forEach(msg => {
                const content = msg.content || '';
                const match = content.match(/(?:\/Users\/[^\s"'`<>|]+?\.(?:html|md|pptx))|(?:(?:\.\/)?[\w.-]+?\.(?:html|md|pptx))/);
                if (match) htmlPathMatch = match;
                
                const blockMatch = content.match(/```html\s*([\s\S]*?)\s*```/);
                if (blockMatch) rawHtmlBlockContent = blockMatch[1];
                else if (content.includes('<!DOCTYPE html>')) {
                    const htmlMatch = content.match(/(<!DOCTYPE html>[\s\S]*|<\s*html[\s\S]*)/i);
                    if (htmlMatch) rawHtmlBlockContent = htmlMatch[0];
                }
            });

            let extraHtmlPreview = "";
            let fileContentFetched = false;
            if (htmlPathMatch) {
                try {
                    const resFile = await fetch(`${API_BASE}/file/content?path=` + encodeURIComponent(htmlPathMatch[0]));
                    if (resFile.ok) {
                        const fileData = await resFile.json();
                        const cleanedFileData = injectRobustDependencies(cleanHtmlContent(fileData.content)); fileContentFetched = true;
                        const safeContent = encodeURIComponent(cleanedFileData).replace(/'/g, "%27");
                        extraHtmlPreview = `
                            <div style="margin-top: 2rem; border: 1px solid #06b6d4; border-radius: 12px; overflow: hidden; background: #000; display: flex; flex-direction: column;">
                                <div style="background: rgba(15, 23, 42, 0.95); padding: 0.8rem 1.5rem; font-weight: 700; color: #06b6d4; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(6, 182, 212, 0.3);">
                                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                                        <span>🌐 历史生成网页沙盒实时预览 (Live Sandbox Preview)</span>
                                        <span style="font-size: 0.85rem; background: rgba(6,182,212,0.2); color: #38bdf8; padding: 0.2rem 0.6rem; border-radius: 4px;">源文件: ${fileData.path.split('/').pop()}</span>
                                    </div>
                                    <button type="button" onclick="window.openFullscreenPreview(decodeURIComponent('${safeContent}'), '历史会话沙盒预览: ${fileData.path.split('/').pop()}')" style="background: linear-gradient(135deg, #06b6d4, #3b82f6); color: #fff; border: none; padding: 0.4rem 1.2rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 4px 12px rgba(6,182,212,0.3); transition: all 0.2s;">
                                        <span>🔲</span> 全屏最大化沉浸预览
                                    </button>
                                </div>
                                <iframe srcdoc="${escapeHtml(cleanedFileData)}" style="width: 100%; height: 650px; border: none; background: #fff;"></iframe>
                            </div>
                        `;
                    }
                } catch (e) {
                    console.error("拉取历史 HTML 失败:", e);
                }
            }
            
            if (!fileContentFetched && rawHtmlBlockContent) {
                const cleanedBlockData = injectRobustDependencies(cleanHtmlContent(rawHtmlBlockContent));
                const safeBlock = encodeURIComponent(cleanedBlockData).replace(/'/g, "%27");
                extraHtmlPreview = `
                    <div style="margin-top: 2rem; border: 1px solid #06b6d4; border-radius: 12px; overflow: hidden; background: #000; display: flex; flex-direction: column;">
                        <div style="background: rgba(15, 23, 42, 0.95); padding: 0.8rem 1.5rem; font-weight: 700; color: #06b6d4; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(6, 182, 212, 0.3);">
                            <div style="display: flex; align-items: center; gap: 0.8rem;">
                                <span>🌐 历史生成网页沙盒实时预览 (Live Sandbox Preview)</span>
                                <span style="font-size: 0.85rem; background: rgba(6,182,212,0.2); color: #38bdf8; padding: 0.2rem 0.6rem; border-radius: 4px;">源文件: 会话直接输出代码块</span>
                            </div>
                            <button type="button" onclick="window.openFullscreenPreview(decodeURIComponent('${safeBlock}'), '历史会话沙盒预览: 代码块源码')" style="background: linear-gradient(135deg, #06b6d4, #3b82f6); color: #fff; border: none; padding: 0.4rem 1.2rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 4px 12px rgba(6,182,212,0.3); transition: all 0.2s;">
                                <span>🔲</span> 全屏最大化沉浸预览
                            </button>
                        </div>
                        <iframe srcdoc="${escapeHtml(cleanedBlockData)}" style="width: 100%; height: 650px; border: none; background: #fff;"></iframe>
                    </div>
                `;
            }

            // 在右侧栏 (deliveryBodyEl) 集中渲染排版精美绝伦的完整 Markdown 研报、历史网页沙盒及产物下载卡片
            if (finalMarkdownContent.trim() || finalArtifactCardHtml || extraHtmlPreview) {
                const cleanMd = processMediaUrls(finalMarkdownContent.trim());
                deliveryBodyEl.innerHTML = `
                    <div class="custom-markdown-container">
                        ${cleanMd ? marked.parse(cleanMd) : (extraHtmlPreview ? '' : '<div class="empty-state"><p>该会话暂无 Markdown 格式的报告正文</p></div>')}
                    </div>
                    ${extraHtmlPreview}
                    ${finalArtifactCardHtml}
                `;
            } else {
                deliveryBodyEl.innerHTML = '<div class="empty-state"><p>该会话暂无最终成果交付物</p></div>';
            }

            // 延迟渲染 Mermaid 图表
            setTimeout(() => {
                try {
                    deliveryBodyEl.querySelectorAll('.language-mermaid').forEach(el => {
                        let text = el.innerHTML;
                        text = text.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
                        // 修复 quadrantChart 语法错误：Mermaid 官方规范要求 x-axis 和 y-axis 必须使用双连字符箭头 -->，而 LLM 常输出单连字符 ->
                        text = text.replace(/x-axis(.*?)->/g, 'x-axis$1-->');
                        text = text.replace(/y-axis(.*?)->/g, 'y-axis$1-->');
                        el.innerHTML = text;
                    });
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
}

window.openFullscreenPreview = function(htmlContent, title = "网页沙盒实时预览") {
    let modal = document.getElementById('fullscreen-preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fullscreen-preview-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(16px); display: flex; flex-direction: column; overflow: hidden; animation: modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);';
        
        const header = document.createElement('div');
        header.style.cssText = 'height: 54px; background: rgba(15, 23, 42, 0.9); border-bottom: 1px solid rgba(6, 182, 212, 0.3); padding: 0 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3);';
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                <span style="font-size: 1.4rem;">🌐</span>
                <span id="fullscreen-preview-title" style="color: #06b6d4; font-weight: 700; font-size: 1.1rem; letter-spacing: 0.5px;"></span>
            </div>
            <button onclick="window.closeFullscreenPreview()" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 0.4rem 1.2rem; border-radius: 6px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.4rem;">
                <span>❌</span> 退出全屏 (ESC)
            </button>
        `;
        
        const iframeContainer = document.createElement('div');
        iframeContainer.style.cssText = 'flex: 1; width: 100%; height: calc(100vh - 54px); background: #fff; overflow: hidden;';
        iframeContainer.innerHTML = `<iframe id="fullscreen-preview-iframe" style="width: 100%; height: 100%; border: none;"></iframe>`;
        
        modal.appendChild(header);
        modal.appendChild(iframeContainer);
        document.body.appendChild(modal);

        // 监听 ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') window.closeFullscreenPreview();
        });
    }

    document.getElementById('fullscreen-preview-title').textContent = title;
    const iframe = document.getElementById('fullscreen-preview-iframe');
    iframe.srcdoc = htmlContent;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // 防止背景滚动
};

window.closeFullscreenPreview = function() {
    const modal = document.getElementById('fullscreen-preview-modal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('fullscreen-preview-iframe').srcdoc = '';
        document.body.style.overflow = '';
    }
};

function downloadReport(sessionId) {
    showToast('📦 正在打包下载调研产物文件...', 'success');
    const link = document.createElement('a'); link.href = `${API_BASE}/artifacts/download/${sessionId}`; link.setAttribute('download', `${sessionId}-deliverables.zip`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

closeDetailBtn.addEventListener('click', () => { detailModal.classList.add('hidden'); });

// ── 2. WebSocket 实时通讯引擎与心跳保活 (WebSocket Bus & Heartbeat) ──
function generateSessionId() { return 'sess_' + Math.random().toString(36).substr(2, 9); }

function initWebSocket() {
    if (ws) ws.close();
    ws = new WebSocket(WS_URL);
    
    const pulse = document.querySelector('.status-pulse');
    const text = document.querySelector('.status-text');

    ws.onopen = () => {
        pulse.style.backgroundColor = '#10b981';
        pulse.style.boxShadow = '0 0 10px #10b981';
        text.textContent = '引擎在线';
        text.style.color = '#10b981';
        showToast('🦞 龙虾特战队核心引擎连接就绪', 'success');
        
        // 启动定时心跳包，防止浏览器或反向代理因超时切断连接
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'ping', timestamp: Date.now() }));
            }
        }, 15000);
    };

    ws.onclose = () => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        pulse.style.backgroundColor = '#f43f5e';
        pulse.style.boxShadow = '0 0 10px #f43f5e';
        text.textContent = '连接断开 (请确认后端服务正常运行)';
        text.style.color = '#f43f5e';
        setTimeout(initWebSocket, 3000);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'pong') return; // 忽略心跳回包
            handleWsMessage(data);
        } catch (e) {
            console.error("解析 WebSocket 消息失败", e);
        }
    };
}

function handleWsMessage(data) {
    // 兼容 trace_id 和 session_id
    const sessionId = data.trace_id || data.session_id;
    if (sessionId && currentSessionId && sessionId !== currentSessionId) return;

    const eventType = data.event_type || data.event;
    const payload = data.payload || data;

    if (eventType === 'WORKFLOW_START') {
        traceContainer.innerHTML = '';
        appendTraceCard({
            state: 'BUILD',
            thinking: `🚀 启动多智能体协作剧本 [${payload.workflow_id || 'crisis_pr'}]，正在编排专家网络...`,
            tools_used: []
        });
        return;
    }

    if (eventType === 'AGENT_ACTIVATED') {
        const agentName = payload.agent || '龙虾专家';
        const nodeId = payload.node_id || '';
        appendTraceCard({
            state: 'COMMAND',
            thinking: `👥 专家参谋 [${agentName}] 介入流转 ${nodeId ? `(节点: ${nodeId})` : ''}`,
            tools_used: []
        });
        return;
    }

    if (eventType === 'THINKING_START') {
        const agentName = payload.agent || '专家参谋';
        appendTraceCard({
            state: 'RUN',
            thinking: `🤔 [${agentName}] 正在进行神经推演与策略生成...`,
            tools_used: []
        });
        return;
    }

    if (eventType === 'TOOL_CALL') {
        const tools = payload.tools || ['系统工具'];
        const details = payload.details || '正在执行底层工具链调用与计算验证...';
        appendTraceCard({
            state: 'TOOL',
            thinking: `🛠️ 正在调度底层工具链计算: ${details}`,
            tools_used: tools
        });
        return;
    }

    if (eventType === 'STREAM_TEXT') {
        const delta = payload.delta || '';
        rawFinalContent += delta;
        
        const emptyState = finalResult.querySelector('.empty-state');
        if (emptyState) finalResult.innerHTML = '';
        
        // 实时刷新当前激活的视图
        if (!webPreviewContainer.classList.contains('hidden')) {
            loadPreviewContent(webPreviewIframe, false);
        } else {
            loadPreviewContent(null, true);
        }
        finalResult.scrollTop = finalResult.scrollHeight;
        return;
    }

    if (eventType === 'HITL_SUSPEND') {
        showHitlPanel(payload.message || "关键决策点触发协同阻断，等待导演审核放行。");
        appendTraceCard({
            state: 'DIRECTOR',
            thinking: `⚠️ 触发协同阻断 (HITL): ${payload.message || '等待人工放行'}`,
            tools_used: ['manual_approve']
        });
        return;
    }

    if (eventType === 'WORKFLOW_END') {
        appendTraceCard({
            state: 'COMPACT',
            thinking: `✨ 多智能体协作链路圆满完成，最终交付物已生成。`,
            tools_used: []
        });
        startBtn.querySelector('.btn-text').textContent = "启动智能体编排网络";
        startBtn.disabled = false;
        showToast('✨ 智能体协作流转结束，交付物就绪', 'success');
        
        // 结束时强制全量拉取一次确保完整渲染
        if (!webPreviewContainer.classList.contains('hidden')) {
            loadPreviewContent(webPreviewIframe, false);
        } else {
            loadPreviewContent(null, true);
        }
        return;
    }

    // 兼容旧的直接带有 state 的格式
    if (data.state) {
        appendTraceCard(data);
        if (data.final_content) {
            rawFinalContent = data.final_content;
            if (!webPreviewContainer.classList.contains('hidden')) {
                loadPreviewContent(webPreviewIframe, false);
            } else {
                loadPreviewContent(null, true);
            }
        }
    }
}

function appendTraceCard(data) {
    const emptyState = traceContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const card = document.createElement('div');
    card.className = `trace-card`;
    
    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const durationStr = (data.duration_ms && parseFloat(data.duration_ms) > 0) 
        ? ` (${parseFloat(data.duration_ms).toFixed(1)}ms)` 
        : '';
    
    let contentHtml = '';
    if (data.thinking) {
        contentHtml += `<div><em>${data.thinking}</em></div>`;
    }
    
    let toolsHtml = '';
    if (data.tools_used && data.tools_used.length > 0) {
        toolsHtml = `<div class="tools-used">`;
        data.tools_used.forEach(tool => {
            toolsHtml += `<span class="tool-chip">⚙️ ${tool}</span>`;
        });
        toolsHtml += `</div>`;
    }

    card.innerHTML = `
        <div class="trace-header">
            <span class="state-badge state-${data.state}">[${data.state}]</span>
            <span class="trace-time">${timeStr}${durationStr}</span>
        </div>
        <div class="trace-content">
            ${contentHtml}
            ${toolsHtml}
        </div>
    `;
    
    traceContainer.appendChild(card);
    traceContainer.scrollTop = traceContainer.scrollHeight;
}

function showHitlPanel(message) {
    hitlMessage.textContent = message || "需要人工介入确认后续操作。";
    hitlPanel.classList.remove('hidden');
    showToast('⚠️ 触发协同阻断，请审核放行', 'error');
}

function hideHitlPanel() { hitlPanel.classList.add('hidden'); }

// ── 3. 工作台事件监听 (Studio Event Listeners) ──
let currentEngineMode = 'workflow'; // 'workflow' or 'general_custom'

engineTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        engineTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentEngineMode = tab.dataset.mode;

        if (currentEngineMode === 'workflow') {
            modeViewWorkflow.classList.add('active');
            modeViewWorkflow.classList.remove('hidden');
            modeViewGeneral.classList.remove('active');
            modeViewGeneral.classList.add('hidden');
        } else {
            modeViewGeneral.classList.add('active');
            modeViewGeneral.classList.remove('hidden');
            modeViewWorkflow.classList.remove('active');
            modeViewWorkflow.classList.add('hidden');
        }
    });
});
workflowSelect.addEventListener('change', () => {
    const previewContainer = document.getElementById('workflow-experts-preview');
    if (!previewContainer) return;
    const wf = workflowSelect.value;
    if (wf === 'web_ppt_squad') {
        previewContainer.innerHTML = '<span class="expert-badge">🏛️ 总督阁下</span><span class="arrow">➔</span><span class="expert-badge">🎨 UIUX设计参谋</span><span class="arrow">➔</span><span class="expert-badge">🛡️ 终审参谋</span>';
    } else if (wf === 'dev_squad') {
        previewContainer.innerHTML = '<span class="expert-badge">🏛️ 总督阁下</span><span class="arrow">➔</span><span class="expert-badge">💻 资深全栈工程师</span><span class="arrow">➔</span><span class="expert-badge">🛡️ 终审参谋</span>';
    } else if (wf === 'bi_finance_squad') {
        previewContainer.innerHTML = '<span class="expert-badge">🏛️ 总督阁下</span><span class="arrow">➔</span><span class="expert-badge">📊 商业智能参谋</span><span class="arrow">➔</span><span class="expert-badge">💰 财务精算师</span>';
    } else if (wf === 'marketing_growth_squad') {
        previewContainer.innerHTML = '<span class="expert-badge">🏛️ 总督阁下</span><span class="arrow">➔</span><span class="expert-badge">🚀 增长黑客参谋</span><span class="arrow">➔</span><span class="expert-badge">📢 品牌创意总监</span>';
    } else if (wf === 'global_expansion_squad') {
        previewContainer.innerHTML = '<span class="expert-badge">🏛️ 总督阁下</span><span class="arrow">➔</span><span class="expert-badge">🌍 跨境出海专家</span><span class="arrow">➔</span><span class="expert-badge">🛡️ 终审参谋</span>';
    } else {
        previewContainer.innerHTML = '<span class="expert-badge">🏛️ 总督阁下</span><span class="arrow">➔</span><span class="expert-badge">📢 公关参谋</span><span class="arrow">➔</span><span class="expert-badge">🛡️ 终审参谋</span>';
    }
});

generalSubmodeSelect.addEventListener('change', () => {
    singleAgentContainer.classList.add('hidden');
    customExpertsContainer.classList.add('hidden');

    if (generalSubmodeSelect.value === 'single_agent') {
        singleAgentContainer.classList.remove('hidden');
    } else if (generalSubmodeSelect.value === 'custom_assembly') {
        customExpertsContainer.classList.remove('hidden');
    }
});

startBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) { showToast("请输入业务需求说明！", "error"); return; }

    let selectedWorkflowId = workflowSelect.value;
    if (currentEngineMode === 'general_custom') {
        if (generalSubmodeSelect.value === 'single_agent') {
            selectedWorkflowId = agentSelect.value;
        } else {
            selectedWorkflowId = generalSubmodeSelect.value; // 'general_chat' or 'custom_assembly'
        }
    }

    let customExperts = null;
    if (currentEngineMode === 'general_custom' && selectedWorkflowId === 'custom_assembly') {
        const checkedBoxes = document.querySelectorAll('#custom-experts-container input[type="checkbox"]:checked');
        customExperts = Array.from(checkedBoxes).map(cb => cb.value);
        if (customExperts.length === 0) {
            showToast("请至少勾选一位参与协同的专家参谋！", "error");
            return;
        }
    }

    currentSessionId = generateSessionId();
    sessionIdDisplay.textContent = currentSessionId;
    rawFinalContent = ""; // 初始化清空完整内容缓存
    traceContainer.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon" style="animation: floatIcon 2s infinite;">⚡</span>
            <p>正在初始化多智能体协作链路与底层专家库...</p>
        </div>
    `;
    finalResult.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">⏳</span>
            <p>正在进行神经推演与多模型生成中...</p>
        </div>
    `;
    webPreviewIframe.srcdoc = ""; // 清空沙盒预览
    hideHitlPanel();

    try {
        const res = await fetch(`${API_BASE}/workflow/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workflow_id: selectedWorkflowId,
                session_id: currentSessionId,
                initial_prompt: prompt,
                custom_experts: customExperts
            })
        });
        
        if (!res.ok) throw new Error("启动编排引擎失败");
        startBtn.querySelector('.btn-text').textContent = "MISSION IN PROGRESS";
        startBtn.disabled = true;
        showToast("🚀 任务指令已发送，专家网络正在响应", "success");
        
    } catch (e) { 
        showToast("API 请求失败: " + e.message + " (请确认后端服务正常运行)", "error");
        startBtn.querySelector('.btn-text').textContent = "启动智能体编排网络";
        startBtn.disabled = false;
    }
});

approveBtn.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        showToast("WebSocket 连接异常，无法发送授权指令", "error");
        return;
    }
    ws.send(JSON.stringify({ action: 'hitl_approve', session_id: currentSessionId }));
    hideHitlPanel();
    appendTraceCard({ state: 'DIRECTOR', duration_ms: 0, thinking: '总督已授权放行，协同阻断解除，继续流转', tools_used: ['manual_approve'] });
    showToast("✅ 已授权放行，工作流继续推演", "success");
});

// ── 4. 专家团队网络加载与渲染 (Experts Directory) ──
async function loadExperts() {
    expertsGrid.innerHTML = `<div class="empty-state"><span class="empty-icon" style="animation: floatIcon 2s infinite;">⏳</span><p>正在从底层架构扫描专家网络...</p></div>`;
    try {
        const res = await fetch(`${API_BASE}/experts`);
        if (!res.ok) throw new Error("获取专家列表失败");
        const data = await res.json();
        allExperts = data.experts || [];
        renderExperts();
    } catch (e) { expertsGrid.innerHTML = `<div class="empty-state" style="color:#f43f5e;"><span class="empty-icon">⚠️</span><p>加载失败: ${e.message}</p></div>`; }
}

function renderExperts() {
    if (allExperts.length === 0) { expertsGrid.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><p>暂无专家团队数据。</p></div>`; return; }
    expertsGrid.innerHTML = '';
    allExperts.forEach(exp => {
        const card = document.createElement('div');
        card.className = 'expert-card';
        card.style.cursor = 'pointer'; // 显现可点击手型
        
        let skillsHtml = exp.skills.map(s => `<span class="meta-chip">⚙️ ${s}</span>`).join('');
        
        card.innerHTML = `
            <div class="card-header-top">
                <div class="avatar-icon">${exp.icon}</div>
                <div class="expert-titles">
                    <h3>${exp.name}</h3>
                    <span>${exp.title_en}</span>
                </div>
            </div>
            <p class="card-desc">${exp.description}</p>
            <div class="card-meta">
                <span class="meta-chip scenario-chip">🎯 绑定场景: ${exp.scenario}</span>
                ${skillsHtml}
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                <button class="card-action-btn view-prompt-btn" data-id="${exp.id}" style="flex:1;">查看指令</button>
                <button class="card-action-btn edit-exp-btn" data-id="${exp.id}" style="flex:1; background:rgba(16,185,129,0.2); border-color:rgba(16,185,129,0.4); color:#10b981;">编辑参谋</button>
                <button class="card-action-btn del-exp-btn" data-id="${exp.id}" style="flex:1; background:rgba(244,63,94,0.2); border-color:rgba(244,63,94,0.4); color:#f43f5e;">删除</button>
            </div>
        `;

        // 点击整张卡片任意区域（除编辑和删除按钮外）即可直接弹出查看系统级提示词准则
        card.addEventListener('click', (e) => {
            if (e.target.closest('.edit-exp-btn') || e.target.closest('.del-exp-btn')) return;
            modalDetailTitle.textContent = `专家参谋系统指令: ${exp.name}`;
            modalDetailBody.innerHTML = `<pre style="background:rgba(0,0,0,0.4);padding:1.5rem;border-radius:8px;white-space:pre-wrap;font-family:inherit;color:#10b981;border:1px solid rgba(16,185,129,0.3);">${exp.system_prompt}</pre>`;
            detailModal.classList.remove('hidden');
        });

        expertsGrid.appendChild(card);
    });

    document.querySelectorAll('.edit-exp-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            const exp = allExperts.find(x => x.id === id);
            if (exp) {
                expertModalTitle.textContent = `编辑专家参谋: ${exp.name}`;
                document.getElementById('exp-id').value = exp.id;
                document.getElementById('exp-id').disabled = true;
                document.getElementById('exp-name').value = exp.name;
                document.getElementById('exp-desc').value = exp.description;
                document.getElementById('exp-prompt').value = exp.system_prompt;
                document.getElementById('exp-req').value = exp.scenario;
                document.getElementById('exp-skills').value = exp.skills.join(', ');
                expertModal.classList.remove('hidden');
            }
        });
    });

    document.querySelectorAll('.del-exp-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm(`确定要无情剔除专家参谋 "${id}" 吗？`)) {
                try {
                    const res = await fetch(`${API_BASE}/experts/${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error("删除失败");
                    showToast("专家参谋剔除成功！", "success");
                    loadExperts();
                } catch (err) { showToast("剔除失败: " + err.message, "error"); }
            }
        });
    });
}

addExpertBtn.addEventListener('click', () => {
    expertForm.reset();
    expertModalTitle.textContent = "添加新专家参谋";
    document.getElementById('exp-id').disabled = false;
    expertModal.classList.remove('hidden');
});

closeExpertModalBtn.addEventListener('click', () => expertModal.classList.add('hidden'));
cancelExpertBtn.addEventListener('click', () => expertModal.classList.add('hidden'));

expertForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        agent_id: document.getElementById('exp-id').value.trim(),
        name: document.getElementById('exp-name').value.trim(),
        role_description: document.getElementById('exp-desc').value.trim(),
        system_prompt: document.getElementById('exp-prompt').value.trim(),
        llm_requirement: document.getElementById('exp-req').value.trim() || 'default',
        skills_allowed: document.getElementById('exp-skills').value.split(',').map(s => s.trim()).filter(Boolean)
    };
    try {
        const res = await fetch(`${API_BASE}/experts`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("保存专家失败");
        showToast("专家参谋配置保存成功！", "success");
        expertModal.classList.add('hidden');
        loadExperts();
    } catch (err) { showToast("保存失败: " + err.message, "error"); }
});

// ── 5. 技能插件库加载与渲染 (Skills Library) ──
async function loadSkills() {
    skillsGrid.innerHTML = `<div class="empty-state"><span class="empty-icon" style="animation: floatIcon 2s infinite;">⏳</span><p>正在从 OpenClaw 及 Eigent 生态挂载技能插件库...</p></div>`;
    try {
        const res = await fetch(`${API_BASE}/skills`);
        if (!res.ok) throw new Error("获取技能列表失败");
        const data = await res.json();
        allSkills = data.skills || [];
        renderSkills();
    } catch (e) { skillsGrid.innerHTML = `<div class="empty-state" style="color:#f43f5e;"><span class="empty-icon">⚠️</span><p>加载失败: ${e.message}</p></div>`; }
}

function renderSkills() {
    if (allSkills.length === 0) { skillsGrid.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><p>暂无技能插件数据。</p></div>`; return; }
    skillsGrid.innerHTML = '';
    allSkills.forEach(skill => {
        const card = document.createElement('div');
        card.className = 'skill-card';
        card.style.cursor = 'pointer'; // 显现可点击手型
        
        const isBuiltin = !skill.name.startsWith('openclaw:');
        const badgeText = isBuiltin ? 'Eigent 内置 OS 工具' : 'OpenClaw 扩展技能';
        const badgeColor = isBuiltin ? '#10b981' : '#ec4899';
        
        card.innerHTML = `
            <div class="card-header-top">
                <div class="avatar-icon" style="color:${badgeColor};border-color:rgba(${isBuiltin?'16,185,129':'236,72,153'},0.3);">${isBuiltin?'⚡':'🛠️'}</div>
                <div class="skill-titles">
                    <h3>${skill.name}</h3>
                    <span style="color:${badgeColor};">${badgeText}</span>
                </div>
            </div>
            <p class="card-desc">${skill.description || '无详细描述'}</p>
            <div class="card-meta">
                <span class="meta-chip" style="color:#06b6d4;border-color:rgba(6,182,212,0.3);">📦 参数定义已就绪</span>
                <span class="meta-chip" style="color:#10b981;border-color:rgba(16,185,129,0.3);">✅ 状态: 启用中</span>
            </div>
            <button class="card-action-btn view-skill-btn" data-name="${skill.name}">查看参数定义与执行指南 (Schema & Docs)</button>
        `;

        // 点击整张卡片任意区域即可直接弹出查看参数定义与执行指南
        card.addEventListener('click', () => {
            modalDetailTitle.textContent = `技能插件定义: ${skill.name}`;
            const paramStr = JSON.stringify(skill.parameters, null, 2);
            modalDetailBody.innerHTML = `
                <h4 style="color:#06b6d4;margin-bottom:0.5rem;">JSON Schema 参数定义</h4>
                <pre style="background:rgba(0,0,0,0.4);padding:1rem;border-radius:8px;white-space:pre-wrap;color:#e2e8f0;border:1px solid rgba(6,182,212,0.3);margin-bottom:1.5rem;">${paramStr}</pre>
                <h4 style="color:#ec4899;margin-bottom:0.5rem;">底层执行指令指南 (Instructions)</h4>
                <pre style="background:rgba(0,0,0,0.4);padding:1rem;border-radius:8px;white-space:pre-wrap;color:#fbcfe8;border:1px solid rgba(236,72,153,0.3);">${skill.instructions || '内置基础工具，由 AgentLoop 原生执行'}</pre>
            `;
            detailModal.classList.remove('hidden');
        });

        skillsGrid.appendChild(card);
    });

    document.querySelectorAll('.view-skill-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = e.currentTarget.getAttribute('data-name');
            const skill = allSkills.find(s => s.name === name);
            if (skill) {
                modalDetailTitle.textContent = `技能插件定义: ${skill.name}`;
                const paramStr = JSON.stringify(skill.parameters, null, 2);
                modalDetailBody.innerHTML = `
                    <h4 style="color:#06b6d4;margin-bottom:0.5rem;">JSON Schema 参数定义</h4>
                    <pre style="background:rgba(0,0,0,0.4);padding:1rem;border-radius:8px;white-space:pre-wrap;color:#e2e8f0;border:1px solid rgba(6,182,212,0.3);margin-bottom:1.5rem;">${paramStr}</pre>
                    <h4 style="color:#ec4899;margin-bottom:0.5rem;">底层执行指令指南 (Instructions)</h4>
                    <pre style="background:rgba(0,0,0,0.4);padding:1rem;border-radius:8px;white-space:pre-wrap;color:#fbcfe8;border:1px solid rgba(236,72,153,0.3);">${skill.instructions || '内置基础工具，由 AgentLoop 原生执行'}</pre>
                `;
                detailModal.classList.remove('hidden');
            }
        });
    });
}

// ── 5.5 原生底层工具链加载与渲染 (Native Tools Library) ──
async function loadTools() {
    toolsGrid.innerHTML = `<div class="empty-state"><span class="empty-icon" style="animation: floatIcon 2s infinite;">⏳</span><p>正在从底层 Harness 编排引擎拉取原生工具链 Schema...</p></div>`;
    try {
        const res = await fetch(`${API_BASE}/tools`);
        if (!res.ok) throw new Error("获取底层工具链失败");
        const data = await res.json();
        allTools = data.tools || [];
        renderTools();
    } catch (e) { toolsGrid.innerHTML = `<div class="empty-state" style="color:#f43f5e;"><span class="empty-icon">⚠️</span><p>加载失败: ${e.message}</p></div>`; }
}

function renderTools() {
    if (allTools.length === 0) { toolsGrid.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><p>暂无底层工具链定义。</p></div>`; return; }
    toolsGrid.innerHTML = '';
    allTools.forEach(tool => {
        const card = document.createElement('div');
        card.className = 'skill-card'; card.style.cursor = 'pointer';
        
        card.innerHTML = `
            <div class="card-header-top">
                <div class="avatar-icon" style="color:#06b6d4;border-color:rgba(6,182,212,0.3);">🛠️</div>
                <div class="skill-titles">
                    <h3>${tool.name}</h3>
                    <span style="color:#06b6d4;">[${tool.tool_id}] · ${tool.category}</span>
                </div>
            </div>
            <p class="card-desc">${tool.description}</p>
            <div class="card-meta">
                <span class="meta-chip" style="color:#38bdf8;border-color:rgba(56,189,248,0.3);">📦 参数 Schema 验证器在线</span>
                <span class="meta-chip" style="color:#10b981;border-color:rgba(16,185,129,0.3);">✅ 沙盒执行态就绪</span>
            </div>
            <button class="card-action-btn view-tool-btn" data-id="${tool.tool_id}">查看完整 Schema 与执行规范</button>
        `;

        card.addEventListener('click', () => {
            modalDetailTitle.textContent = `底层原生工具定义: ${tool.name}`;
            const paramStr = JSON.stringify(tool.parameters, null, 2);
            modalDetailBody.innerHTML = `
                <h4 style="color:#06b6d4;margin-bottom:0.5rem;">JSON Schema 参数规范</h4>
                <pre style="background:rgba(0,0,0,0.4);padding:1rem;border-radius:8px;white-space:pre-wrap;color:#e2e8f0;border:1px solid rgba(6,182,212,0.3);margin-bottom:1.5rem;">${paramStr}</pre>
                <h4 style="color:#10b981;margin-bottom:0.5rem;">底层调用调度准则 (Instructions)</h4>
                <pre style="background:rgba(0,0,0,0.4);padding:1rem;border-radius:8px;white-space:pre-wrap;color:#a7f3d0;border:1px solid rgba(16,185,129,0.3);">${tool.instructions}</pre>
            `;
            detailModal.classList.remove('hidden');
        });

        toolsGrid.appendChild(card);
    });

    document.querySelectorAll('.view-tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            const tool = allTools.find(t => t.tool_id === id);
            if (tool) {
                modalDetailTitle.textContent = `底层原生工具定义: ${tool.name}`;
                const paramStr = JSON.stringify(tool.parameters, null, 2);
                modalDetailBody.innerHTML = `
                    <h4 style="color:#06b6d4;margin-bottom:0.5rem;">JSON Schema 参数规范</h4>
                    <pre style="background:rgba(0,0,0,0.4);padding:1rem;border-radius:8px;white-space:pre-wrap;color:#e2e8f0;border:1px solid rgba(6,182,212,0.3);margin-bottom:1.5rem;">${paramStr}</pre>
                    <h4 style="color:#10b981;margin-bottom:0.5rem;">底层调用调度准则 (Instructions)</h4>
                    <pre style="background:rgba(0,0,0,0.4);padding:1rem;border-radius:8px;white-space:pre-wrap;color:#a7f3d0;border:1px solid rgba(16,185,129,0.3);">${tool.instructions}</pre>
                `;
                detailModal.classList.remove('hidden');
            }
        });
    });
}

// ── 6. 大模型配置表管理 (Config Matrix Management) ──
resetFormBtn.addEventListener('click', () => {
    configForm.reset();
    formTitle.textContent = "添加新路由配置";
    document.getElementById('cfg-id').disabled = false;
});

async function loadConfigs() {
    configList.innerHTML = `<div class="empty-state"><span class="empty-icon" style="animation: floatIcon 2s infinite;">⏳</span><p>正在从 SQLite 数据库加载路由配置矩阵...</p></div>`;
    try {
        const res = await fetch(`${API_BASE}/models/config`);
        if (!res.ok) throw new Error("获取配置列表失败");
        const data = await res.json();
        allConfigs = data.configs || [];
        renderConfigList();
    } catch (e) { configList.innerHTML = `<div class="empty-state" style="color:#f43f5e;"><span class="empty-icon">⚠️</span><p>加载失败: ${e.message}</p></div>`; }
}

function renderConfigList() {
    if (allConfigs.length === 0) { configList.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><p>暂无任何模型配置，请在右侧表单添加第一条规则。</p></div>`; return; }
    configList.innerHTML = '';
    allConfigs.forEach(cfg => {
        const card = document.createElement('div');
        card.className = `config-item-card ${cfg.is_fallback ? 'fallback' : ''}`;
        
        const isGlobal = cfg.scenario === 'default';
        const cardTitle = isGlobal ? '🌟 全局默认大模型池 (Global Default)' : '🎯 独立大模型资源卡';
        const scopeDesc = isGlobal ? '分配规则: 默认供所有未指定特殊模型的专家共享使用' : `分配规则: 供绑定标识为 "${cfg.scenario}" 的专家调用`;
        
        card.innerHTML = `
            <div class="config-info">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                    <h4 style="color:#06b6d4; font-size:1.2rem; margin:0;">${cardTitle}</h4>
                    <span class="scenario-label" style="background:rgba(6,182,212,0.2); color:#06b6d4; border:1px solid rgba(6,182,212,0.4); padding:2px 8px; border-radius:4px; font-size:0.8rem;">ID: ${cfg.id}</span>
                </div>
                <p style="color:#e2e8f0; margin:0.4rem 0;"><strong>模型完整名称:</strong> <span style="color:#10b981;">${cfg.model_name}</span></p>
                <p style="color:#94a3b8; font-size:0.9rem; margin:0.4rem 0;"><strong>AI 服务商:</strong> ${cfg.provider_name.toUpperCase()} | <strong>绑定组名标识:</strong> <span style="color:#38bdf8;">${cfg.scenario}</span> | <strong>优先级:</strong> ${cfg.priority}</p>
                <p style="color:#94a3b8; font-size:0.9rem; margin:0.4rem 0;"><strong>${scopeDesc}</strong></p>
                <div class="config-tags" style="margin-top:0.8rem;">
                    <span class="tag" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.3);">状态: 正常启用</span>
                    ${cfg.is_fallback ? '<span class="tag fallback-tag" style="background:rgba(244,63,94,0.2); color:#f43f5e; border:1px solid rgba(244,63,94,0.3);">自动回退备用</span>' : ''}
                </div>
            </div>
            <div class="config-card-actions" style="display:flex; gap:0.5rem; margin-top:1rem;">
                <button class="secondary-button btn-sm edit-cfg-btn" data-id="${cfg.id}" style="flex:1; background:rgba(6,182,212,0.2); border-color:rgba(6,182,212,0.4); color:#06b6d4;">✏️ 修改配置 / 密钥</button>
                <button class="secondary-button btn-sm del-cfg-btn" data-id="${cfg.id}" style="flex:1; background:rgba(244,63,94,0.2); border-color:rgba(244,63,94,0.4); color:#f43f5e;">🗑️ 删除</button>
            </div>
        `;
        configList.appendChild(card);
    });

    document.querySelectorAll('.edit-cfg-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const cfg = allConfigs.find(c => c.id === id);
            if (cfg) fillEditForm(cfg);
        });
    });

    document.querySelectorAll('.del-cfg-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm(`确定要删除模型配置 "${id}" 吗？`)) { await deleteConfig(id); }
        });
    });
}

function fillEditForm(cfg) {
    formTitle.textContent = `编辑路由配置: ${cfg.id}`;
    document.getElementById('cfg-id').value = cfg.id;
    document.getElementById('cfg-id').disabled = true;
    document.getElementById('cfg-scenario').value = cfg.scenario;
    document.getElementById('cfg-model').value = cfg.model_name;
    document.getElementById('cfg-provider').value = cfg.provider_name;
    document.getElementById('cfg-base').value = cfg.api_base || "";
    document.getElementById('cfg-key').value = cfg.api_key || "";
    document.getElementById('cfg-tokens').value = cfg.max_tokens;
    document.getElementById('cfg-temp').value = cfg.temperature;
    document.getElementById('cfg-fallback').checked = cfg.is_fallback;
    document.getElementById('cfg-priority').value = cfg.priority;
}

configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        id: document.getElementById('cfg-id').value.trim(),
        scenario: document.getElementById('cfg-scenario').value.trim(),
        model_name: document.getElementById('cfg-model').value.trim(),
        provider_name: document.getElementById('cfg-provider').value,
        api_base: document.getElementById('cfg-base').value.trim(),
        api_key: document.getElementById('cfg-key').value.trim(),
        max_tokens: parseInt(document.getElementById('cfg-tokens').value) || 8192,
        temperature: parseFloat(document.getElementById('cfg-temp').value) || 0.1,
        is_fallback: document.getElementById('cfg-fallback').checked,
        priority: parseInt(document.getElementById('cfg-priority').value) || 1
    };

    try {
        const res = await fetch(`${API_BASE}/models/config`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("保存路由配置失败");
        showToast("配置保存成功！", "success");
        configForm.reset(); formTitle.textContent = "添加新路由配置"; document.getElementById('cfg-id').disabled = false;
        loadConfigs();
    } catch (err) { showToast("保存失败: " + err.message, "error"); }
});

async function deleteConfig(id) {
    try {
        const res = await fetch(`${API_BASE}/models/config/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("删除路由失败");
        showToast("路由配置删除成功！", "success"); loadConfigs();
    } catch (err) { showToast("删除失败: " + err.message, "error"); }
}

// Init
initWebSocket();
