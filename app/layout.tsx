import type { Metadata } from "next";
import { Special_Elite, JetBrains_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

// Self-hosted via next/font: no render-blocking request to
// fonts.googleapis.com, fonts preload with the page and display:swap keeps
// text visible while they load. Exposed as CSS variables used in globals.css.
const specialElite = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-special",
  display: "swap",
});
const jetBrainsMono = JetBrains_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PackProof - skill packs with published proof",
  description:
    "Small workflow packs for your coding agent. Every release ships pinned versions, before-and-after runs, and the failures.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${specialElite.variable} ${jetBrainsMono.variable}`}>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
// Pending feedback for the native GET search forms (nav + discover toolbar).
// Delegated capture listener attached at parse time, so it works even before
// React hydrates and cannot be lost to hydration timing on document unload.
// No preventDefault: the GET submission and shareable URL are untouched.
function setB(f,on){
  if(f.__ppT){clearTimeout(f.__ppT);f.__ppT=null;}
  if(on){f.setAttribute('data-pp-busy','');f.setAttribute('aria-busy','true');}
  else{f.removeAttribute('data-pp-busy');f.setAttribute('aria-busy','false');}
  var b=f.querySelector('button[type=submit]');if(b)b.disabled=on;
  var inp=f.querySelector('input[name=q]');if(inp&&f.classList.contains('searchbox'))inp.readOnly=on;
  // If the navigation never commits (failed request, user pressed stop), the
  // page stays put - restore interactivity after 20s so the form is never
  // permanently locked. A committed navigation takes the timer down with it.
  if(on){f.__ppT=setTimeout(function(){setB(f,false);},20000);}
}
document.addEventListener('submit',function(e){
  var f=e.target;
  if(f&&f.tagName==='FORM'&&(f.querySelector('.btn-label')||f.classList.contains('searchbox')))setB(f,true);
},true);
window.addEventListener('pageshow',function(e){
  if(!e.persisted)return;
  var forms=document.querySelectorAll('form[data-pp-busy]');
  for(var i=0;i<forms.length;i++)setB(forms[i],false);
});
})();`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
