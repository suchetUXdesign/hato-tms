"use strict";(()=>{var M="",K="";function S(e,t){M=e.replace(/\/$/,""),K=t}function v(){return!!M&&!!K}async function k(e,t,n){let o={"Content-Type":"application/json","X-API-Token":K},l=await fetch(`${M}${t}`,{method:e,headers:o,body:n?JSON.stringify(n):void 0});if(!l.ok){let c=await l.text().catch(()=>"");throw new Error(`API ${l.status}: ${c||l.statusText}`)}return l.json()}async function D(){let e=await k("GET","/api/v1/namespaces");return Array.isArray(e)?e:e.data??e}async function N(e=100,t,n){let o=new URLSearchParams;return o.set("pageSize",String(e)),o.set("sortBy","updated"),o.set("sortOrder","desc"),t&&o.set("namespace",t),n&&o.set("platform",n),(await k("GET",`/api/v1/keys?${o.toString()}`)).data}async function B(e,t){let n=new URLSearchParams;return e&&n.set("query",e),t&&n.set("namespace",t),n.set("pageSize","20"),(await k("GET",`/api/v1/keys?${n.toString()}`)).data}async function w(e){return k("GET",`/api/v1/keys/${e}`)}async function A(e){return k("POST","/api/v1/keys",e)}var s="not-authenticated",T=[],i=null,L=[],r=null,d="th",E={},C=!0,g=[],f=!1,z=[],O=[],b="",h="";async function P(){try{z=await D();let e=new Set;for(let t of z)for(let n of t.platforms??[])e.add(n);O=Array.from(e).sort()}catch(e){console.warn("Failed to load namespaces:",e)}}async function $(){if(!f){f=!0,a();try{z.length===0&&await P(),g=await N(100,b||void 0,h||void 0);for(let e of g)m(e);f=!1,a()}catch(e){console.warn("Failed to load keys:",e),f=!1,C=!1,s="offline",a()}}}function R(){try{let e=localStorage.getItem("hato-tms-api-url"),t=localStorage.getItem("hato-tms-token");e&&t&&(S(e,t),s="search",$())}catch(e){console.warn("localStorage not available:",e),s="not-authenticated"}a();try{parent.postMessage({pluginMessage:{type:"get-selection"}},"*")}catch(e){console.warn("postMessage failed:",e)}}window.onmessage=async e=>{let t=e.data?.pluginMessage;if(t)switch(t.type){case"selection":if(i=t.data,i?.multiple&&i.textLayers&&i.textLayers.length>0&&v())H(i.textLayers),s="multi-match",a();else if(i?.linked&&i.keyId&&v()){try{r=await w(i.keyId),m(r),s="linked-layer"}catch{s="search"}a()}else v()&&(r=null,s="search"),a();break}};function H(e){T=e.map(t=>{if(t.linked&&t.keyId){let o=g.find(l=>l.id===t.keyId);return{layer:t,matchedKey:o||null,matchLocale:d}}let n=t.text.trim();if(!n)return{layer:t,matchedKey:null,matchLocale:""};for(let o of g)for(let l of o.values)if(l.value.trim()===n)return{layer:t,matchedKey:o,matchLocale:l.locale.toLowerCase()};return{layer:t,matchedKey:null,matchLocale:""}})}function m(e){let t={};for(let n of e.values)t[n.locale.toLowerCase()]=n.value,t[n.locale.toUpperCase()]=n.value;E[e.id]=t}function a(){let e=document.getElementById("app");if(e)switch(s){case"not-authenticated":e.innerHTML=V(),Y();break;case"search":e.innerHTML=j(),Q();break;case"results":e.innerHTML=U(),Z();break;case"linked-layer":e.innerHTML=q(),_();break;case"create-key":e.innerHTML=G(),ee();break;case"multi-match":e.innerHTML=J(),W();break;case"offline":e.innerHTML=X(),te();break}}function V(){return`
    <div style="padding: 16px;">
      <h2 style="font-size: 14px; font-weight: 600; margin-bottom: 16px; color: #333;">
        Hato TMS
      </h2>
      <p style="color: #666; margin-bottom: 16px; font-size: 11px;">
        Connect to your Hato TMS server to manage translations.
      </p>
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 11px; font-weight: 500; color: #555; margin-bottom: 4px;">API URL</label>
        <input id="auth-url" type="text" value="https://hato-tms-api.vercel.app"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          placeholder="https://hato-tms-api.vercel.app" />
      </div>
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 11px; font-weight: 500; color: #555; margin-bottom: 4px;">API Token</label>
        <input id="auth-token" type="password"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          placeholder="Paste your API token" />
      </div>
      <button id="auth-submit"
        style="width: 100%; padding: 8px; background: #18A0FB; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">
        Connect
      </button>
      <div id="auth-error" style="color: #E53935; font-size: 11px; margin-top: 8px; display: none;"></div>
    </div>
  `}function j(){let e=ne();return`
    <div style="padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="font-size: 13px; font-weight: 600; color: #333;">Hato TMS</h2>
        <div style="display: flex; gap: 4px;">
          <button id="btn-sync-all" title="Sync all"
            style="padding: 4px 8px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer;">
            Sync
          </button>
          <button id="btn-switch-lang" title="Switch language"
            style="padding: 4px 8px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: 600;">
            ${d.toUpperCase()}
          </button>
          <button id="btn-highlight" title="Highlight unlinked"
            style="padding: 4px 8px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer;">
            Unlinked
          </button>
        </div>
      </div>

      ${e}

      <div style="margin-bottom: 12px;">
        <input id="search-input" type="text"
          style="width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 11px; outline: none;"
          placeholder="Search translation keys\u2026" />
      </div>

      <div style="display: flex; gap: 6px; margin-bottom: 10px;">
        <select id="filter-namespace"
          style="flex: 1; padding: 5px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; color: #555; background: white; outline: none; cursor: pointer;">
          <option value="">All namespaces</option>
          ${z.map(t=>`
            <option value="${u(t.path)}" ${b===t.path?"selected":""}>
              ${t.path}${t.keyCount!=null?` (${t.keyCount})`:""}
            </option>
          `).join("")}
        </select>
        <select id="filter-platform"
          style="flex: 1; padding: 5px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; color: #555; background: white; outline: none; cursor: pointer;">
          <option value="">All platforms</option>
          ${O.map(t=>`
            <option value="${u(t)}" ${h===t?"selected":""}>
              ${t}
            </option>
          `).join("")}
        </select>
      </div>

      <button id="btn-create-key"
        style="width: 100%; padding: 6px; background: none; border: 1px dashed #ccc; border-radius: 6px; font-size: 11px; color: #666; cursor: pointer;">
        + Create new key
      </button>

      <div id="search-results" style="margin-top: 8px;"></div>

      ${f?`
        <div style="text-align: center; padding: 16px; color: #999; font-size: 11px;">
          Loading translations\u2026
        </div>
      `:g.length>0?`
        <div style="margin-top: 12px;">
          <div style="font-size: 10px; color: #888; margin-bottom: 6px; font-weight: 500;">
            ${g.length} TRANSLATIONS${b?` in ${b}`:""}${h?` \xB7 ${h}`:""}
          </div>
          <div style="max-height: 220px; overflow-y: auto;">
            ${g.map(t=>`
              <div class="browse-item" data-key-id="${t.id}"
                style="padding: 8px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 4px; cursor: pointer; transition: background 0.1s;"
                onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-size: 11px; font-weight: 500; color: #333;">${t.fullKey}</div>
                  ${t.platforms?.length?`<div style="font-size: 9px; color: #aaa;">${t.platforms.join(", ")}</div>`:""}
                </div>
                <div style="font-size: 10px; color: #888; margin-top: 2px;">TH: ${x(p(t,"th"),35)}</div>
                <div style="font-size: 10px; color: #888;">EN: ${x(p(t,"en"),35)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `:f?"":`
        <div style="text-align: center; padding: 20px; color: #999; font-size: 11px;">
          No translations found${b||h?" for this filter":""}
        </div>
      `}
    </div>
  `}function U(){let e=L.map(t=>`
      <div class="result-item" data-key-id="${t.id}" data-key-name="${t.fullKey}"
        data-th-value="${u(p(t,"th"))}"
        data-en-value="${u(p(t,"en"))}"
        style="padding: 8px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 6px; cursor: pointer; transition: background 0.1s;"
        onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="font-size: 11px; font-weight: 500; color: #333; margin-bottom: 2px;">${t.fullKey}</div>
        <div style="font-size: 10px; color: #888;">TH: ${x(p(t,"th"),40)}</div>
        <div style="font-size: 10px; color: #888;">EN: ${x(p(t,"en"),40)}</div>
        ${i?.isText?`<button class="btn-link" data-key-id="${t.id}" data-key-name="${t.fullKey}"
          style="margin-top: 4px; padding: 3px 10px; background: #18A0FB; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer;">
          Link
        </button>`:""}
      </div>
    `).join("");return`
    <div style="padding: 12px;">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <button id="btn-back"
          style="padding: 4px 8px; background: none; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer; margin-right: 8px;">
          Back
        </button>
        <span style="font-size: 11px; color: #666;">${L.length} results</span>
      </div>
      <div>${e||'<p style="color: #999; font-size: 11px; text-align: center; padding: 20px;">No results found</p>'}</div>
    </div>
  `}function q(){if(!r||!i)return"";let e=p(r,"th"),t=p(r,"en");return`
    <div style="padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <button id="btn-back-search"
          style="padding: 4px 8px; background: none; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer;">
          Back
        </button>
        <button id="btn-switch-lang-linked" title="Switch language"
          style="padding: 4px 8px; background: #18A0FB; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: 600;">
          ${d.toUpperCase()}
        </button>
      </div>

      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px;">
        <div style="font-size: 10px; color: #888; margin-bottom: 2px;">LINKED KEY</div>
        <div style="font-size: 12px; font-weight: 600; color: #333; margin-bottom: 8px;">${r.fullKey}</div>

        <div style="font-size: 10px; color: #888; margin-bottom: 2px;">Layer: ${i.name}</div>

        <div style="margin-top: 10px;">
          <div style="font-size: 10px; font-weight: 500; color: #555; margin-bottom: 2px;">TH</div>
          <div style="font-size: 11px; color: #333; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #eee; margin-bottom: 6px;">${e||'<span style="color: #ccc;">\u2014</span>'}</div>
        </div>

        <div>
          <div style="font-size: 10px; font-weight: 500; color: #555; margin-bottom: 2px;">EN</div>
          <div style="font-size: 11px; color: #333; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #eee;">${t||'<span style="color: #ccc;">\u2014</span>'}</div>
        </div>
      </div>

      <div style="display: flex; gap: 6px;">
        <button id="btn-unlink"
          style="flex: 1; padding: 6px; background: none; border: 1px solid #E53935; border-radius: 6px; font-size: 11px; color: #E53935; cursor: pointer;">
          Unlink
        </button>
        <button id="btn-refresh-linked"
          style="flex: 1; padding: 6px; background: #18A0FB; color: white; border: none; border-radius: 6px; font-size: 11px; cursor: pointer;">
          Refresh
        </button>
      </div>

      <div style="margin-top: 8px; font-size: 10px; color: #aaa;">
        Status: ${r.status} | Tags: ${r.tags.join(", ")||"none"}
      </div>
    </div>
  `}function G(){return`
    <div style="padding: 12px;">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <button id="btn-back-create"
          style="padding: 4px 8px; background: none; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer; margin-right: 8px;">
          Back
        </button>
        <h3 style="font-size: 12px; font-weight: 600; color: #333;">Create Key</h3>
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 10px; font-weight: 500; color: #555; margin-bottom: 3px;">Namespace</label>
        <input id="create-namespace" type="text"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          placeholder="e.g. common" />
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 10px; font-weight: 500; color: #555; margin-bottom: 3px;">Key Name</label>
        <input id="create-keyname" type="text"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          placeholder="e.g. welcomeTitle" />
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 10px; font-weight: 500; color: #555; margin-bottom: 3px;">Thai Value</label>
        <input id="create-th" type="text"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          value="${u(i?.text||"")}" />
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 10px; font-weight: 500; color: #555; margin-bottom: 3px;">English Value</label>
        <input id="create-en" type="text"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;" />
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 10px; font-weight: 500; color: #555; margin-bottom: 3px;">Description (optional)</label>
        <input id="create-desc" type="text"
          style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none;"
          placeholder="What is this text used for?" />
      </div>

      <button id="btn-create-submit"
        style="width: 100%; padding: 8px; background: #18A0FB; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">
        Create & Link
      </button>

      <div id="create-error" style="color: #E53935; font-size: 11px; margin-top: 8px; display: none;"></div>
    </div>
  `}function J(){let e=T.filter(n=>n.matchedKey),t=T.filter(n=>!n.matchedKey);return`
    <div style="padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="font-size: 13px; font-weight: 600; color: #333;">Bulk Sync</h2>
        <button id="btn-back-multi"
          style="padding: 4px 8px; background: none; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; cursor: pointer;">
          Back
        </button>
      </div>

      <div style="padding: 8px; background: #E8F5E9; border-radius: 6px; margin-bottom: 10px; font-size: 11px; color: #2E7D32;">
        ${e.length} of ${T.length} text layers matched with TMS
      </div>

      ${e.length>0?`
        <button id="btn-bulk-sync"
          style="width: 100%; padding: 8px; background: #18A0FB; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; margin-bottom: 12px;">
          Sync ${e.length} layers & rename to keys
        </button>
      `:""}

      <div style="max-height: 280px; overflow-y: auto;">
        ${e.map((n,o)=>`
          <div class="match-item" data-index="${o}"
            style="padding: 8px; border: 1px solid #C8E6C9; background: #F1F8E9; border-radius: 6px; margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 10px; color: #888; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                title="${u(n.layer.name)}">
                ${n.layer.name}
              </div>
              <div style="font-size: 9px; color: #4CAF50; font-weight: 500;">MATCHED</div>
            </div>
            <div style="font-size: 10px; color: #555; margin: 3px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
              title="${u(n.layer.text)}">
              "${x(n.layer.text,30)}"
            </div>
            <div style="font-size: 11px; font-weight: 500; color: #1B5E20;">
              \u2192 ${n.matchedKey.fullKey}
            </div>
          </div>
        `).join("")}

        ${t.length>0?`
          <div style="font-size: 10px; color: #999; margin: 8px 0 4px; font-weight: 500;">
            ${t.length} UNMATCHED
          </div>
          ${t.map(n=>`
            <div style="padding: 8px; border: 1px solid #eee; background: #FAFAFA; border-radius: 6px; margin-bottom: 4px;">
              <div style="font-size: 10px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                title="${u(n.layer.name)}">
                ${n.layer.name}
              </div>
              <div style="font-size: 10px; color: #999; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                "${x(n.layer.text,35)}"
              </div>
              <div style="font-size: 9px; color: #E65100; margin-top: 2px;">No match in TMS</div>
            </div>
          `).join("")}
        `:""}
      </div>
    </div>
  `}function W(){document.getElementById("btn-back-multi")?.addEventListener("click",()=>{s="search",a()}),document.getElementById("btn-bulk-sync")?.addEventListener("click",()=>{let e=T.filter(n=>n.matchedKey);if(e.length===0)return;let t=e.map(n=>{let o=n.matchedKey;m(o);let l=p(o,d)||p(o,d.toUpperCase())||p(o,n.matchLocale)||n.layer.text;return{nodeId:n.layer.id,keyId:o.id,keyName:o.fullKey,value:l,locale:d}});parent.postMessage({pluginMessage:{type:"bulk-sync",items:t}},"*")})}function X(){return`
    <div style="padding: 16px; text-align: center;">
      <div style="background: #FFF3E0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="font-size: 12px; font-weight: 600; color: #E65100; margin-bottom: 4px;">Offline</div>
        <div style="font-size: 11px; color: #BF360C;">
          Cannot reach the TMS server. Cached data may be available.
        </div>
      </div>
      <div style="font-size: 10px; color: #999; margin-bottom: 12px;">
        ${Object.keys(E).length} keys cached locally
      </div>
      <button id="btn-retry"
        style="padding: 8px 16px; background: #18A0FB; color: white; border: none; border-radius: 6px; font-size: 11px; cursor: pointer;">
        Retry Connection
      </button>
    </div>
  `}function Y(){document.getElementById("auth-submit")?.addEventListener("click",()=>{let t=document.getElementById("auth-url").value.trim(),n=document.getElementById("auth-token").value.trim(),o=document.getElementById("auth-error");if(!t||!n){o.style.display="block",o.textContent="Please fill in both fields.";return}S(t,n);try{localStorage.setItem("hato-tms-api-url",t),localStorage.setItem("hato-tms-token",n)}catch{}s="search",a(),parent.postMessage({pluginMessage:{type:"get-selection"}},"*"),$()})}function Q(){let e=document.getElementById("search-input"),t;e?.addEventListener("input",()=>{clearTimeout(t),t=setTimeout(async()=>{let n=e.value.trim();if(n.length<2){document.getElementById("search-results").innerHTML="";return}try{L=await B(n),s="results",a()}catch{C=!1,s="offline",a()}},300)}),e?.addEventListener("keydown",n=>{if(n.key==="Enter"){clearTimeout(t);let o=e.value.trim();o.length>=1&&B(o).then(l=>{L=l,s="results",a()}).catch(()=>{s="offline",a()})}}),document.getElementById("btn-create-key")?.addEventListener("click",()=>{s="create-key",a()}),document.getElementById("btn-multi-sync")?.addEventListener("click",()=>{i?.multiple&&i.textLayers&&(H(i.textLayers),s="multi-match",a())}),document.getElementById("filter-namespace")?.addEventListener("change",n=>{b=n.target.value,$()}),document.getElementById("filter-platform")?.addEventListener("change",n=>{h=n.target.value,$()}),document.getElementById("btn-sync-all")?.addEventListener("click",()=>{parent.postMessage({pluginMessage:{type:"sync-all",translations:E,locale:d}},"*")}),document.getElementById("btn-switch-lang")?.addEventListener("click",()=>{d=d==="th"?"en":"th",parent.postMessage({pluginMessage:{type:"switch-language",locale:d,translations:E}},"*"),a()}),document.getElementById("btn-highlight")?.addEventListener("click",()=>{parent.postMessage({pluginMessage:{type:"highlight-unlinked"}},"*")}),document.querySelectorAll(".browse-item").forEach(n=>{n.addEventListener("click",async()=>{let l=n.dataset.keyId;try{r=await w(l),m(r),s="linked-layer",a()}catch{}})})}function Z(){document.getElementById("btn-back")?.addEventListener("click",()=>{s="search",a()}),document.querySelectorAll(".btn-link").forEach(e=>{e.addEventListener("click",t=>{t.stopPropagation();let n=e,o=n.dataset.keyId,l=n.dataset.keyName,c=n.closest(".result-item"),I=d==="th"?c.dataset.thValue:c.dataset.enValue;E[o]={th:c.dataset.thValue||"",TH:c.dataset.thValue||"",en:c.dataset.enValue||"",EN:c.dataset.enValue||""},parent.postMessage({pluginMessage:{type:"link-key",keyId:o,keyName:l,value:I||"",locale:d}},"*")})}),document.querySelectorAll(".result-item").forEach(e=>{e.addEventListener("click",async t=>{if(t.target.classList.contains("btn-link"))return;let o=e.dataset.keyId;try{r=await w(o),m(r),s="linked-layer",a()}catch{}})})}function _(){document.getElementById("btn-back-search")?.addEventListener("click",()=>{s="search",a()}),document.getElementById("btn-unlink")?.addEventListener("click",()=>{i?.isText&&(parent.postMessage({pluginMessage:{type:"link-key",keyId:"",keyName:"",value:i.text||"",locale:d}},"*"),r=null,s="search",a())}),document.getElementById("btn-refresh-linked")?.addEventListener("click",async()=>{if(r)try{r=await w(r.id),m(r);let e=p(r,d);parent.postMessage({pluginMessage:{type:"link-key",keyId:r.id,keyName:r.fullKey,value:e,locale:d}},"*"),a(),parent.postMessage({pluginMessage:{type:"notify",message:"Refreshed!"}},"*")}catch{s="offline",a()}}),document.getElementById("btn-switch-lang-linked")?.addEventListener("click",()=>{if(d=d==="th"?"en":"th",r&&i?.isText){let e=p(r,d);parent.postMessage({pluginMessage:{type:"link-key",keyId:r.id,keyName:r.fullKey,value:e,locale:d}},"*")}a()})}function ee(){document.getElementById("btn-back-create")?.addEventListener("click",()=>{s="search",a()}),document.getElementById("btn-create-submit")?.addEventListener("click",async()=>{let e=document.getElementById("create-namespace").value.trim(),t=document.getElementById("create-keyname").value.trim(),n=document.getElementById("create-th").value.trim(),o=document.getElementById("create-en").value.trim(),l=document.getElementById("create-desc").value.trim(),c=document.getElementById("create-error");if(!e||!t||!n||!o){c.style.display="block",c.textContent="Namespace, key name, and both values are required.";return}let I={namespacePath:e,keyName:t,thValue:n,enValue:o,description:l||void 0};try{let y=await A(I);if(m(y),i?.isText){let F=d==="th"?n:o;parent.postMessage({pluginMessage:{type:"create-key",keyId:y.id,keyName:y.fullKey,value:F,locale:d}},"*")}parent.postMessage({pluginMessage:{type:"notify",message:`Created ${y.fullKey}`}},"*"),r=y,s=i?.isText?"linked-layer":"search",a()}catch(y){c.style.display="block",c.textContent=y?.message||"Failed to create key."}})}function te(){document.getElementById("btn-retry")?.addEventListener("click",()=>{C=!0,s=v()?"search":"not-authenticated",a()})}function ne(){if(!i)return`<div style="padding: 8px; background: #f5f5f5; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #888;">
      Select a text layer to link translations.
    </div>`;if(i.multiple){let e=i.textCount??0;return e>0?`<div style="padding: 8px; background: #E3F2FD; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #1565C0;">
        ${e} text layers selected
        <button id="btn-multi-sync" style="margin-left: 8px; padding: 3px 10px; background: #18A0FB; color: white; border: none; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: 500;">
          Match & Sync
        </button>
      </div>`:`<div style="padding: 8px; background: #FFF3E0; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #E65100;">
      ${i.count} layers selected \u2014 no text layers found.
    </div>`}return i.isText?`<div style="padding: 8px; background: #E3F2FD; border-radius: 6px; margin-bottom: 12px;">
    <div style="font-size: 10px; color: #1565C0; font-weight: 500;">${i.name}</div>
    <div style="font-size: 11px; color: #333; margin-top: 2px;">${x(i.text||"",60)}</div>
    ${i.linked?`<div style="font-size: 10px; color: #2E7D32; margin-top: 4px;">Linked: ${i.keyName}</div>`:""}
  </div>`:`<div style="padding: 8px; background: #f5f5f5; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #888;">
      Selected: ${i.name} (${i.type}) \u2014 not a text layer
    </div>`}function p(e,t){let n=t.toUpperCase();return e.values.find(l=>l.locale.toUpperCase()===n)?.value||""}function x(e,t){return e.length<=t?e:e.substring(0,t)+"..."}function u(e){return e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}R();})();
