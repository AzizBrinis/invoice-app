import { THEME_COOKIE, THEME_STORAGE_KEY } from "./theme-constants";

export function ThemeScript() {
  const script = `(function(){try{var storageKey="${THEME_STORAGE_KEY}";var cookieKey="${THEME_COOKIE}";var stored;try{stored=localStorage.getItem(storageKey);}catch(e){stored=null;}var cookies=document.cookie?document.cookie.split("; "):[];var cookieTheme=null;for(var i=0;i<cookies.length;i++){var parts=cookies[i].split("=");if(parts[0]===cookieKey){cookieTheme=decodeURIComponent(parts[1]);break;}}var theme=stored||cookieTheme||"system";var isThemeValue=theme==="light"||theme==="dark"||theme==="system";if(!isThemeValue){theme="system";}var resolved=theme==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):theme;var targets=[document.documentElement,document.body].filter(Boolean);for(var j=0;j<targets.length;j++){var element=targets[j];element.dataset.theme=theme;element.dataset.themeResolved=resolved;element.style.colorScheme=resolved;if(resolved==="dark"){element.classList.add("dark");}else{element.classList.remove("dark");}}}catch(e){}})();`;

  return (
    <script
      id="theme-script"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
