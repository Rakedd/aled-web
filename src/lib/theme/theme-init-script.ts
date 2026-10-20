import {
  DARK_COLOR_SCHEME_QUERY,
  DEFAULT_THEME_PREFERENCE,
  PAGE_BACKGROUND_CUSTOM_PROPERTY,
  type ResolvedTheme,
  THEME_ATTRIBUTE,
  THEME_COLOR_META_NAME,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from './theme-preference'

const SYSTEM_THEME_PREFERENCE: ThemePreference = 'system'
const DARK_THEME: ResolvedTheme = 'dark'
const LIGHT_THEME: ResolvedTheme = 'light'

const asScriptLiteral = (value: string | readonly string[]) => JSON.stringify(value)

export const THEME_INIT_SCRIPT = [
  '(function(){try{',
  'var d=document,r=d.documentElement,w=window,',
  `q=w.matchMedia?w.matchMedia(${asScriptLiteral(DARK_COLOR_SCHEME_QUERY)}):null,`,
  'p=function(){try{',
  `var v=w.localStorage.getItem(${asScriptLiteral(THEME_STORAGE_KEY)});`,
  `return ${asScriptLiteral(THEME_PREFERENCES)}.indexOf(v)>-1?v:${asScriptLiteral(DEFAULT_THEME_PREFERENCE)}`,
  `}catch(e){return ${asScriptLiteral(DEFAULT_THEME_PREFERENCE)}}},`,
  `g=function(v){return v===${asScriptLiteral(SYSTEM_THEME_PREFERENCE)}?(q&&q.matches?${asScriptLiteral(DARK_THEME)}:${asScriptLiteral(LIGHT_THEME)}):v},`,
  'm=function(){',
  `var c=w.getComputedStyle(r).getPropertyValue(${asScriptLiteral(PAGE_BACKGROUND_CUSTOM_PROPERTY)}).trim();`,
  'if(!c)return false;',
  `var e=d.querySelector('meta[name="${THEME_COLOR_META_NAME}"]');`,
  `if(!e){e=d.createElement("meta");e.name=${asScriptLiteral(THEME_COLOR_META_NAME)};d.head.appendChild(e)}`,
  'e.content=c;return true},',
  'a=function(v){',
  `r.setAttribute(${asScriptLiteral(THEME_ATTRIBUTE)},g(v));`,
  'if(!m())d.addEventListener("DOMContentLoaded",function(){m()})},',
  `h=function(){var v=p();if(v===${asScriptLiteral(SYSTEM_THEME_PREFERENCE)})a(v)};`,
  'a(p());',
  `w.addEventListener("storage",function(e){if(e.key===${asScriptLiteral(THEME_STORAGE_KEY)})a(p())});`,
  'if(q){if(q.addEventListener)q.addEventListener("change",h);else if(q.addListener)q.addListener(h)}',
  '}catch(e){}})()',
].join('')
