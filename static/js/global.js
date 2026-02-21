/**
 * global.js - 个人主页交互逻辑（精简优化版）
 */

// --- 配置常量 ---
const CONFIG = {
    START_YEAR: 2008,
    TIMEOUT: 5000,
    API: {
        WHOIS: 'https://api.mrwang.com/whois.php?domain=',
        TRACE: 'https://cloudflare.com/cdn-cgi/trace',
        CONTACT: 'https://lianxi.wangxiansheng.com/contact.php'
    }
};

// --- 工具函数 ---
const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

// --- 1. 自动更新页脚版权年份 ---
const initCopyright = () => {
    const yearEl = $('year');
    if (yearEl) {
        yearEl.textContent = `${CONFIG.START_YEAR}-${new Date().getFullYear()}`;
    }
};

// --- 2. 模态框控制逻辑 ---
function showModal(id) {
    const modal = $(id);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const modal = $(id);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// --- 3. 赞助支付方式切换 ---
function switchPay(type, btn) {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    $$('.qrcode').forEach(q => q.classList.remove('active'));
    const targetQr = $(`qr-${type}`);
    if (targetQr) targetQr.classList.add('active');

    const tip = $('pay-tip');
    if (tip) tip.textContent = `使用${type === 'alipay' ? '支付宝' : '微信'}扫码`;
}

// --- 4. Whois 域名信息查询 ---
async function openWhois(domain) {
    const loader = '<i class="fa-solid fa-ellipsis fa-fade"></i>';
    const fields = ['res-age', 'res-rem', 'res-reg', 'res-date-create', 'res-date-update', 'res-date-expire', 'res-status', 'res-ns'];
    
    // 初始化 UI
    $('whoisDomain').innerText = domain.toUpperCase();
    $('res-bar').style.width = '0%';
    fields.forEach(id => { if ($(id)) $(id).innerHTML = loader; });

    showModal('whoisModal');

    try {
        const response = await fetch(`${CONFIG.API.WHOIS}${domain}`);
        const res = await response.json();

        if (res.code === 0 && res.data) {
            const d = res.data;
            const start = new Date(d.creationDateISO8601).getTime();
            const end = new Date(d.expirationDateISO8601).getTime();
            const now = Date.now();
            
            // 进度条计算
            const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
            $('res-bar').style.width = `${progress}%`;
            
            const formatTime = (str) => (str || "").replace(/(\d+)([YMoD]+)/g, '<b>$1</b>$2')
                                                .replace('Y','年').replace('Mo','月').replace('D','天');
            
            $('res-age').innerHTML = formatTime(d.age);
            $('res-rem').innerHTML = formatTime(d.remaining);
            $('res-reg').innerText = d.registrar || "未知";
            $('res-date-create').innerText = (d.creationDateISO8601 || "").split('T')[0] || "-";
            $('res-date-update').innerText = (d.updatedDateISO8601 || "").split('T')[0] || "-";
            $('res-date-expire').innerText = (d.expirationDateISO8601 || "").split('T')[0] || "-";
            $('res-status').innerHTML = d.status?.map(s => `<span class="tag-status">${s.text.split(' ')[0]}</span>`).join('') || "OK";
            $('res-ns').innerText = d.nameServers ? d.nameServers.join('\n').toLowerCase() : "-";
        } else {
            throw new Error('API Error');
        }
    } catch (e) { 
        $('res-ns').innerText = "查询失败";
        ['res-age', 'res-rem', 'res-reg'].forEach(id => { if ($(id)) $(id).innerText = "--"; });
    }
}

// --- 5. 获取访客 IP 信息 ---
async function getVisitorIP() {
    try {
        const response = await fetch(CONFIG.API.TRACE);
        const text = await response.text();
        return text.match(/ip=([^\s]+)/)?.[1] || '未知IP';
    } catch (e) { return '获取失败'; }
}

// --- 6. 联系表单异步提交 ---
const contactForm = $('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = $('submitBtn');
        const formMessage = $('formMessage');
        
        submitBtn.disabled = true;
        formMessage.style.display = "block"; 
        formMessage.textContent = "正在提交...";
        formMessage.className = "text-info";
        
        const visitorIp = await getVisitorIP();
        const formData = {
            name: $('name').value.trim(),
            contactInfo: $('contactInfo').value.trim(),
            message: $('message').value.trim(),
            ip: visitorIp 
        };

        try {
            const response = await fetch(CONFIG.API.CONTACT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error();

            formMessage.textContent = "提交成功！我会尽快联系您。";
            formMessage.className = "text-success";
            contactForm.reset();
            
            setTimeout(() => { 
                closeModal('messageModal'); 
                // 彻底重置提示状态
                setTimeout(() => {
                    formMessage.textContent = "";
                    formMessage.style.display = "none";
                }, 300);
            }, 2000);
        } catch (err) {
            formMessage.textContent = "提交错误，请稍后再试";
            formMessage.className = "text-danger";
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// --- 7. 网站存活状态在线检测 (优化：并行执行) ---
async function checkWebsiteStatus() {
    const sites = $$('.site-status');
    const checkSite = async (site) => {
        const dot = site.querySelector('.status-dot');
        if (!dot) return;
        
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
        
        try {
            await fetch(site.href, { mode: 'no-cors', cache: 'no-cache', signal: controller.signal });
            dot.className = 'status-dot online';
        } catch (e) {
            dot.className = 'status-dot offline';
        } finally {
            clearTimeout(timer);
        }
    };
    // 同时发起所有请求，不排队
    Promise.all(Array.from(sites).map(checkSite));
}

// --- 8. 页面加载初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    initCopyright();

    // 主面板入场动画
    const panel = $('panel');
    if (panel) {
        setTimeout(() => {
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0)';
        }, 150);
    }

    // 点击遮罩层关闭模态框
    $$('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    checkWebsiteStatus();
});