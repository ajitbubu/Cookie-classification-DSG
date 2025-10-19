/**
 * Utility functions for cookie scanner
 */

/**
 * Generate bookmarklet code for cross-domain scanning
 */
export function generateBookmarklet() {
  // Simplified bookmarklet code that definitely works
  const bookmarkletCode = `(function(){
var cookies=document.cookie.split(';').map(function(c){var parts=c.trim().split('=');return{name:parts[0]||'',value:parts[1]||'',domain:location.hostname}}).filter(function(c){return c.name});
var classify=function(cookie){var name=cookie.name.toLowerCase();if(name.includes('session')||name.includes('csrf')||name.includes('auth'))return{cat:'Necessary',req:false,gdpr:'LOW',ccpa:'LOW'};if(name.includes('_ga')||name.includes('analytics'))return{cat:'Analytics',req:true,gdpr:'HIGH',ccpa:'MEDIUM'};if(name.includes('_fb')||name.includes('ads')||name.includes('_gcl'))return{cat:'Marketing',req:true,gdpr:'HIGH',ccpa:'HIGH'};if(name.includes('lang')||name.includes('pref'))return{cat:'Functional',req:true,gdpr:'MEDIUM',ccpa:'LOW'};return{cat:'Unclassified',req:true,gdpr:'MEDIUM',ccpa:'MEDIUM'}};
var analyzed=cookies.map(function(c){var cls=classify(c);return{name:c.name,value:c.value,domain:c.domain,category:cls.cat,requiresConsent:cls.req,gdprRisk:cls.gdpr,ccpaRisk:cls.ccpa}});
var stats={total:analyzed.length,consent:0,cats:{}};
analyzed.forEach(function(c){if(c.requiresConsent)stats.consent++;stats.cats[c.category]=(stats.cats[c.category]||0)+1});
var html='<html><head><meta charset="UTF-8"><title>Cookie Scanner - '+location.hostname+'</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh}.container{max-width:1200px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden}.header{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px}.header h1{font-size:28px;margin-bottom:10px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;padding:20px;background:#f9fafb}.stat-card{background:#fff;padding:20px;border-radius:8px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.1)}.stat-number{font-size:32px;font-weight:bold;color:#667eea;margin-bottom:8px}.stat-label{font-size:14px;color:#6b7280}table{width:100%;border-collapse:collapse;margin:20px}th,td{padding:12px;text-align:left;border-bottom:1px solid #e5e7eb}th{background:#f9fafb;font-weight:600;color:#374151;font-size:12px;text-transform:uppercase}tbody tr:hover{background:#f9fafb}.badge{display:inline-block;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600}.badge-green{background:#d1fae5;color:#065f46}.badge-blue{background:#dbeafe;color:#1e40af}.badge-orange{background:#fed7aa;color:#9a3412}.badge-gray{background:#f3f4f6;color:#374151}.risk{display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;margin:2px}.risk-high{background:#fee2e2;color:#991b1b}.risk-medium{background:#fef3c7;color:#92400e}.risk-low{background:#d1fae5;color:#065f46}.actions{padding:20px;background:#f9fafb;display:flex;gap:10px;justify-content:flex-end}button{padding:10px 20px;border:none;border-radius:6px;font-weight:600;cursor:pointer;background:#667eea;color:#fff}button:hover{background:#5568d3}</style></head><body><div class="container"><div class="header"><h1>🍪 Cookie Scanner Results</h1><p><strong>Domain:</strong> '+location.hostname+'</p><p><strong>Scanned:</strong> '+new Date().toLocaleString()+'</p></div><div class="stats"><div class="stat-card"><div class="stat-number">'+stats.total+'</div><div class="stat-label">Total Cookies</div></div><div class="stat-card"><div class="stat-number">'+stats.consent+'</div><div class="stat-label">Require Consent</div></div>';
Object.keys(stats.cats).forEach(function(cat){html+='<div class="stat-card"><div class="stat-number">'+stats.cats[cat]+'</div><div class="stat-label">'+cat+'</div></div>'});
html+='</div><div style="padding:20px"><table><thead><tr><th>Cookie Name</th><th>Category</th><th>GDPR Risk</th><th>CCPA Risk</th><th>Value Preview</th></tr></thead><tbody>';
analyzed.forEach(function(c){var badgeClass=c.category==='Necessary'?'badge-green':c.category==='Analytics'?'badge-blue':c.category==='Marketing'?'badge-orange':'badge-gray';html+='<tr><td><strong>'+c.name+'</strong></td><td><span class="badge '+badgeClass+'">'+c.category+'</span></td><td><span class="risk risk-'+c.gdprRisk.toLowerCase()+'">'+c.gdprRisk+'</span></td><td><span class="risk risk-'+c.ccpaRisk.toLowerCase()+'">'+c.ccpaRisk+'</span></td><td style="font-family:monospace;font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">'+c.value.substring(0,40)+(c.value.length>40?'...':'')+'</td></tr>'});
html+='</tbody></table></div><div class="actions"><button onclick="window.print()">🖨️ Print</button><button onclick="exportCSV()">📥 CSV</button></div></div><script>function exportCSV(){var csv="Name,Domain,Category,GDPR Risk,CCPA Risk,Value\\n";';
html+='analyzed.forEach(function(c){csv+="\\""+c.name+"\\",\\""+c.domain+"\\",\\""+c.category+"\\",\\""+c.gdprRisk+"\\",\\""+c.ccpaRisk+"\\",\\""+c.value+"\\"\\n"});';
html+='var blob=new Blob([csv],{type:"text/csv"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="cookies_"+location.hostname+"_"+Date.now()+".csv";a.click();URL.revokeObjectURL(url)}';
html+='var analyzed='+JSON.stringify(analyzed)+';<\/script></body></html>';
var win=window.open('','Cookie Scanner','width=1000,height=700');
win.document.write(html);
win.document.close();
})();`;

  return 'javascript:' + encodeURIComponent(bookmarkletCode);
}

/**
 * Copy text to clipboard
 */
export function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return Promise.resolve();
    } catch (err) {
      document.body.removeChild(textArea);
      return Promise.reject(err);
    }
  }
}

/**
 * Download file helper
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format timestamp
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Validate URL
 */
export function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}
