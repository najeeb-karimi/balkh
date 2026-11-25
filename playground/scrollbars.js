const axes = [
  { name: 'vertical', coordinate: 'clientY', start: 'top', length: 'clientHeight' },
  { name: 'horizontal', coordinate: 'clientX', start: 'left', length: 'clientWidth' },
];

// Track and thumb are shared by Monaco and ordinary browser scroll containers.
// The adapter handles scrolling, so drawing a thumb never feeds a scroll event back in.
export function createScrollbars(container, { read, scrollTo, onWheel }) {
  const bars = axes.map(axis => {
    const track = document.createElement('div');
    track.className = `scrollbar-track scrollbar-${axis.name}`;
    track.setAttribute('aria-hidden', 'true');
    track.hidden = true;
    const thumb = document.createElement('div');
    thumb.className = 'scrollbar-thumb';
    track.append(thumb);
    container.append(track);

    let drag;
    let range = 0;
    let travel = 0;
    let size = 0;
    let offset = 0;

    function position(event) {
      return event[axis.coordinate] - track.getBoundingClientRect()[axis.start];
    }

    function move(event) {
      if (travel <= 0) return;
      const fraction = Math.max(0, Math.min(1, (position(event) - drag.grab) / travel));
      scrollTo(axis.name, fraction * range);
    }

    track.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag || travel <= 0) return;
      event.preventDefault();
      drag = { pointer: event.pointerId, grab: event.target === thumb ? position(event) - offset : size / 2 };
      track.setPointerCapture(event.pointerId);
      track.classList.add('dragging');
      if (event.target !== thumb) move(event);
    });
    track.addEventListener('pointermove', event => {
      if (drag?.pointer === event.pointerId) move(event);
    });
    track.addEventListener('lostpointercapture', () => {
      drag = undefined;
      track.classList.remove('dragging');
    });
    track.addEventListener('wheel', onWheel, { passive: false });

    return {
      track,
      layout({ viewport, content, position }) {
        if (track.hidden) { travel = 0; return; }
        const length = track[axis.length];
        range = content - viewport;
        const minimum = Math.min(28, length * .65);
        size = Math.max(minimum, length * viewport / content);
        travel = length - size;
        offset = travel * Math.max(0, Math.min(1, position / range));
        const vertical = axis.name === 'vertical';
        thumb.style[vertical ? 'height' : 'width'] = `${size}px`;
        thumb.style.transform = vertical ? `translateY(${offset}px)` : `translateX(${offset}px)`;
      },
    };
  });

  return {
    update() {
      const metrics = read();
      bars.forEach(({ track }, index) => {
        const { name } = axes[index];
        const { viewport, content } = metrics[name];
        const visible = viewport > 0 && content > viewport;
        track.hidden = !visible;
        container.classList.toggle(`scrolls-${name}`, visible);
      });
      bars.forEach((bar, index) => bar.layout(metrics[axes[index].name]));
    },
    dispose() { bars.forEach(({ track }) => track.remove()); },
  };
}

export function attachNativeScrollbars(container, viewport) {
  const horizontalOrigin = viewport => getComputedStyle(viewport).direction === 'rtl' ? viewport.scrollWidth - viewport.clientWidth : 0;
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; bars.update(); });
  };
  const bars = createScrollbars(container, {
    read() {
      return {
        vertical: { viewport: viewport.clientHeight, content: viewport.scrollHeight, position: viewport.scrollTop },
        horizontal: { viewport: viewport.clientWidth, content: viewport.scrollWidth, position: viewport.scrollLeft + horizontalOrigin(viewport) },
      };
    },
    scrollTo(axis, position) {
      if (axis === 'vertical') viewport.scrollTop = position;
      else viewport.scrollLeft = position - horizontalOrigin(viewport);
      bars.update();
    },
    onWheel(event) {
      if (event.ctrlKey) return;
      const { scrollTop, scrollLeft } = viewport;
      const { deltaMode, deltaX, deltaY } = event;
      const line = deltaMode === 1 ? parseFloat(getComputedStyle(viewport).lineHeight) || 16 : 1;
      viewport.scrollBy(deltaX * (deltaMode === 2 ? viewport.clientWidth : line),
        deltaY * (deltaMode === 2 ? viewport.clientHeight : line));
      if (viewport.scrollTop !== scrollTop || viewport.scrollLeft !== scrollLeft) event.preventDefault();
    },
  });

  const size = new ResizeObserver(schedule);
  const content = new MutationObserver(schedule);
  viewport.classList.add('custom-scroll-viewport');
  size.observe(viewport);
  content.observe(viewport, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'dir'] });
  viewport.addEventListener('scroll', schedule, { passive: true });
  viewport.addEventListener('input', schedule);
  schedule();
  return schedule;
}
