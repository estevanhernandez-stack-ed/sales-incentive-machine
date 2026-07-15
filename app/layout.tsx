import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "SIM — Sales Incentive Machine",
  description: "A local-first sales contest tool for restaurant managers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{const t=JSON.parse(localStorage.getItem('sim-theme'));if(t){const r=document.documentElement,x=h=>{const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]},a=(h,o)=>'rgba('+x(h).join(', ')+', '+o+')',l=(h,o)=>'rgb('+x(h).map(c=>Math.round(c+(255-c)*o)).join(', ')+')',v={'--bg':t.bg,'--card':a(t.glass_on_mica,t.glass_alpha??.8),'--chrome':a(t.glass_on_mica,.92),'--glass-hover':l(t.glass,.1),'--border':a(t.border_tint??t.border,t.border_alpha??.4),'--text':t.text,'--text-secondary':t.text_secondary,'--text-dim':t.text_dim,'--text-muted':t.text_muted,'--accent':t.accent,'--positive':t.positive,'--negative':t.negative,'--bingo-marked':t.bingo_marked,'--pace-marker':t.pace_marker,'--bar-bg':t.bar_bg,'--card-radius':(t.card_corner_radius??10)+'px'};[t.accent,t.positive,t.negative,t.pace_marker,t.text_dim,t.bingo_marked].forEach((c,i)=>v['--wheel-'+(i+1)]=c);Object.entries(v).forEach(([k,v])=>r.style.setProperty(k,v));if(t.opts_out_of_mica)r.classList.add('no-glass')}}catch{}` }} /></head>
      <body>{children}</body>
    </html>
  );
}
