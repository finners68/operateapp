import { useCallback, useEffect, useRef, useState } from 'react';
import { call, relDay } from '../api/operate.js';
import { Icon, LegacyHtml } from '../show/ui.jsx';

function readCarouselIndex(scroller: any){
  if(!scroller) return 0;
  const w = Math.max(scroller.clientWidth, 1);
  return Math.max(0, Math.min(Math.round(scroller.scrollLeft / w), scroller.children.length - 1));
}

function UpNextStepCard({ run, step, stepIdx }: Record<string, any>){
  const pillsHtml = call('stepPills', step) || '';
  const flightWidget = step?.ref && step.kind === 'travel' && (step.ref.icon || 'plane') === 'plane'
    ? call('flightInfoWidget', step.ref)
    : '';

  return (
    <article
      data-step-idx={stepIdx}
      className="up-next-slide up-next-pane hero nextshow"
      onClick={() => call('timelineStepOptions', run.key, step.id)}
      role="group"
      aria-label={step.title}
    >
      <div className="hero-label">
        <Icon name={step.icon || 'clock'} size={14} />{' '}
        {relDay ? relDay(step.date) : step.date}
        {step.time ? ` · ${step.time}` : ''}
      </div>
      <div className="hero-venue" style={{ fontSize: 22, marginTop: 6 }}>{step.title}</div>
      {step.sub ? <div className="hero-city">{step.sub}</div> : null}
      {pillsHtml ? (
        <div className="hero-info" style={{ marginTop: 15, flexWrap: 'wrap' }} dangerouslySetInnerHTML={{ __html: pillsHtml }} />
      ) : null}
      {flightWidget ? <LegacyHtml html={flightWidget} /> : null}
    </article>
  );
}

export function UpNextTimelineCarousel({ run, timeline }: Record<string, any>){
  const tl = timeline || [];
  const focusIdx = Math.max(0, tl.findIndex((s: any) => !s.done));
  const scrollerRef = useRef<any>(null);
  const [viewIdx, setViewIdx] = useState(focusIdx);

  const syncIndexFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if(!el) return;
    setViewIdx(readCarouselIndex(el));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if(!el || !tl.length) return;
    const slide = el.querySelector(`[data-step-idx="${focusIdx}"]`);
    if(slide){
      slide.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      setViewIdx(focusIdx);
    }
  }, [run?.key, focusIdx, tl.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if(!el) return;
    const onScroll = () => syncIndexFromScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [syncIndexFromScroll, tl.length]);

  const scrollByPage = (dir: any) => {
    const el = scrollerRef.current;
    if(!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };

  if(!tl.length){
    return <div className="hint">Add flights &amp; hotels inside each show</div>;
  }

  const atStart = viewIdx <= 0;
  const atEnd = viewIdx >= tl.length - 1;

  return (
    <div className="card up-next-deck">
      <div className="up-next-deck-head">
        <p className="up-next-scroll-hint up-next-scroll-hint--touch">Swipe for earlier or later steps</p>
        <p className="up-next-scroll-hint up-next-scroll-hint--desktop">Use arrows or the scrollbar below</p>
        <div className="up-next-deck-nav">
          <button
            type="button"
            className="header-btn"
            title="Previous step"
            disabled={atStart}
            onClick={() => scrollByPage(-1)}
          >
            <Icon name="chevL" size={18} />
          </button>
          <span className="up-next-deck-pos" aria-live="polite">
            {viewIdx + 1} / {tl.length}
          </span>
          <button
            type="button"
            className="header-btn"
            title="Next step"
            disabled={atEnd}
            onClick={() => scrollByPage(1)}
          >
            <Icon name="chevR" size={18} />
          </button>
        </div>
      </div>
      <div
        className="up-next-carousel up-next-carousel--inset up-next-carousel--desktop-bar"
        ref={scrollerRef}
        data-next-idx={focusIdx}
        aria-label="Tour timeline steps"
        tabIndex={0}
      >
        {tl.map((step: any, i: any) => (
          <UpNextStepCard key={step.id} run={run} step={step} stepIdx={i} />
        ))}
      </div>
    </div>
  );
}
