// animations.ts — Uses the GSAP npm package (tree-shaken safe)
// Works both with CDN global and npm import

type GsapGlobal = typeof import('gsap').gsap;

function getGsap(): GsapGlobal | null {
  if (typeof window !== 'undefined') {
    const w = window as unknown as { gsap?: GsapGlobal };
    if (w.gsap) return w.gsap;
  }
  return null;
}

export const OrionAnimations = {
  boot() {
    const gsap = getGsap();
    if (!gsap) return;

    gsap.set(['.sidebar', '.top-nav', '.visualizer-container', '.chat-section'], { opacity: 0 });
    gsap.set('.sidebar', { x: -50 });
    gsap.set('.chat-section', { y: 60 });
    gsap.set('.top-nav', { y: -30 });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to('.sidebar', { x: 0, opacity: 1, duration: 1.2 })
      .to('.top-nav', { y: 0, opacity: 1, duration: 1.0 }, '-=0.8')
      .to('.visualizer-container', { opacity: 1, duration: 1.5 }, '-=0.6')
      .to('.chat-section', { y: 0, opacity: 1, duration: 1.2 }, '-=1.0')
      .from('.logo', { letterSpacing: '12px', duration: 1.5, ease: 'power4.out' }, '-=1.2');
  },

  animateMessage(element: HTMLElement) {
    const gsap = getGsap();
    if (!gsap) return;
    gsap.fromTo(
      element,
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.2)', clearProps: 'transform' }
    );
  },

  toggleSidebar(open: boolean) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const gsap = getGsap();
    if (open) {
      sidebar.classList.add('open');
      if (gsap) gsap.to(sidebar, { x: 0, duration: 0.5, ease: 'power3.out' });
    } else {
      if (gsap) {
        gsap.to(sidebar, {
          x: -280,
          duration: 0.5,
          ease: 'power3.inOut',
          onComplete: () => sidebar.classList.remove('open'),
        });
      } else {
        sidebar.classList.remove('open');
      }
    }
  },

  sweepThemeTransition(oldMode: string, newMode: string) {
    const gsap = getGsap();
    if (!gsap) return;
    const glows = document.querySelectorAll('.bg-glow');
    gsap.timeline()
      .to(glows, { opacity: 0.8, scale: 1.1, duration: 0.3, stagger: 0.1, ease: 'power2.in' })
      .to(glows, { opacity: 1, scale: 1.0, duration: 0.8, ease: 'power2.out' });
    gsap.fromTo(
      '.visualizer-container',
      { scale: 0.96 },
      { scale: 1.0, duration: 1.0, ease: 'elastic.out(1, 0.6)' }
    );
  },

  animateMicState(active: boolean) {
    const gsap = getGsap();
    const micBtn = document.getElementById('btn-voice');
    if (!micBtn || !gsap) return;
    if (active) {
      gsap.to(micBtn, {
        scale: 1.15,
        boxShadow: '0 0 25px rgba(239, 68, 68, 0.8)',
        duration: 0.4,
        yoyo: true,
        repeat: -1,
        ease: 'power1.inOut',
      });
    } else {
      gsap.killTweensOf(micBtn);
      gsap.to(micBtn, { scale: 1, boxShadow: 'none', duration: 0.3, ease: 'power2.out' });
    }
  },
};
