"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, ImageOff } from "lucide-react";
import { resolveMediaUrl, type TrendingProduct } from "@/services/api";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/components/site-config-provider";
import { localizedField } from "@/lib/i18n";
import {
  AnimatedText,
  TypewriterText,
  useReducedMotion,
} from "@/components/animated";

export type HeroSlideData = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;
  destination?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  desktopImage?: string;
  imageUrl?: string;
  mobileImage?: string;
  mobileImageUrl?: string;
  videoUrl?: string;
  customLabel?: string;
  layoutVariant?: string;
  typingSpeedMs?: number;
  backgroundColor?: string;
  textAlignment?: string;
  contentPosition?: string;
  backgroundPosition?: string;
  animationType?: string;
  slideDuration?: number;
  transitionDuration?: number;
  autoplayEnabled?: boolean;
  pauseOnHover?: boolean;
  showNavigationArrows?: boolean;
  showPaginationDots?: boolean;
  loopSlides?: boolean;
};

const alignment = {
  LEFT: "text-left items-start",
  CENTER: "text-center items-center",
  RIGHT: "text-right items-end",
} as const;
const position = {
  TOP: "justify-start pt-16",
  CENTER: "justify-center",
  BOTTOM: "justify-end pb-16",
} as const;
const animationNames = {
  FADE: "hero-fade",
  SLIDE_LEFT: "hero-slide-left",
  SLIDE_RIGHT: "hero-slide-right",
} as const;
const imageAnimationNames: Record<string, string> = {
  NONE: "none",
  FADE: "hero-fade",
  FADE_UP: "hero-slide-up",
  FADE_DOWN: "hero-slide-down",
  FADE_LEFT: "hero-slide-left",
  FADE_RIGHT: "hero-slide-right",
  SLIDE_LEFT: "hero-slide-left",
  SLIDE_RIGHT: "hero-slide-right",
  SOFT_SCALE: "hero-subtle-zoom",
  ZOOM_IN: "hero-zoom-in",
  ZOOM_OUT: "hero-zoom-out",
  KEN_BURNS: "hero-ken-burns",
  SUBTLE_PARALLAX: "hero-subtle-zoom",
  SCALE_FADE: "hero-scale-fade",
};
const transitionNames: Record<string, string> = {
  FADE: "hero-transition-fade",
  CROSS_FADE: "hero-transition-fade",
  SLIDE_LEFT: "hero-transition-slide-left",
  SLIDE_RIGHT: "hero-transition-slide-right",
  SLIDE_UP: "hero-transition-slide-up",
  SLIDE_DOWN: "hero-transition-slide-down",
  SOFT_ZOOM: "hero-transition-soft-zoom",
  SCALE_FADE: "hero-transition-scale-fade",
  BLUR_FADE: "hero-transition-blur-fade",
  KEN_BURNS: "hero-transition-ken-burns",
};

function slideImage(slide: HeroSlideData) {
  return resolveMediaUrl(slide.desktopImage ?? slide.imageUrl);
}
function mobileImage(slide: HeroSlideData) {
  return resolveMediaUrl(
    slide.mobileImage ??
      slide.mobileImageUrl ??
      slide.desktopImage ??
      slide.imageUrl,
  );
}

function HeroVideo({
  src,
  poster,
  title,
  reducedMotion,
  autoplay,
  onDuration,
  onError,
}: {
  src: string;
  poster?: string;
  title: string;
  reducedMotion: boolean;
  autoplay: boolean;
  onDuration: (durationSeconds: number) => void;
  onError: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion || !autoplay) return;

    // Muted autoplay is allowed by modern browsers. Calling play after the
    // source is ready also covers videos selected or replaced dynamically.
    const startPlayback = () => {
      video.muted = true;
      void video.play().catch(() => {
        // A browser may still block playback; the poster remains a safe
        // fallback without surfacing native media controls over the design.
      });
    };

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) startPlayback();
    else video.addEventListener("canplay", startPlayback, { once: true });
    return () => video.removeEventListener("canplay", startPlayback);
  }, [autoplay, reducedMotion, src]);

  return (
    <div className="relative flex min-h-[220px] max-h-[520px] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950 shadow-sm">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoplay && !reducedMotion}
        muted
        controls={false}
        loop
        playsInline
        preload="auto"
        aria-label={title || "Homepage campaign video"}
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          if (Number.isFinite(duration) && duration > 0) onDuration(duration);
        }}
        onDurationChange={(event) => {
          const duration = event.currentTarget.duration;
          if (Number.isFinite(duration) && duration > 0) onDuration(duration);
        }}
        onError={onError}
        className="block h-auto max-h-[520px] w-auto max-w-full object-contain"
      >
        Your browser cannot play this video. The poster image is shown instead.
      </video>
    </div>
  );
}

export function HeroSlider({
  slides,
  trendingProducts = [],
  preview = false,
}: {
  slides: HeroSlideData[];
  trendingProducts?: TrendingProduct[];
  preview?: boolean;
}) {
  const { design, locale } = useSiteConfig();
  const [active, setActive] = useState(0);
  const [activeVisit, setActiveVisit] = useState(0);
  const [paused, setPaused] = useState(false);
  const systemReducedMotion = useReducedMotion();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [failedVideos, setFailedVideos] = useState<Record<string, boolean>>({});
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({});
  const activeIndex = Math.min(active, Math.max(0, slides.length - 1));
  const current = slides[activeIndex];
  const video = current?.videoUrl ? resolveMediaUrl(current.videoUrl) : undefined;
  const videoKey = `${current?.id ?? "none"}:${video ?? ""}`;
  const failedVideo = failedVideos[videoKey];
  const isVideoSlide = Boolean(video && !failedVideo);
  const videoDurationSeconds = videoDurations[videoKey];
  const mediaDurationMs = videoDurationSeconds
    ? Math.round(videoDurationSeconds * 1000)
    : (current?.slideDuration ?? 5000);

  const reducedMotion =
    systemReducedMotion || design.animationsEnabled === false;

  const advanceSlide = useCallback(() => {
    if (slides.length < 2) return;
    setActive((index) =>
      current?.loopSlides === false
        ? Math.min(slides.length - 1, index + 1)
        : (index + 1) % slides.length,
    );
  }, [current?.loopSlides, slides.length]);

  useEffect(() => {
    // Replaying the typewriter on every revisit is intentional, even when the
    // slider returns to the same index after cycling through other slides.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveVisit((visit) => visit + 1);
  }, [activeIndex]);

  useEffect(() => {
    if (
      !current ||
      preview ||
      paused ||
      slides.length < 2 ||
      current.autoplayEnabled === false ||
      reducedMotion
    )
      return;
    // Video slides advance from the media `ended` event. A timer here would
    // cut portrait/landscape videos off before their actual duration.
    if (isVideoSlide) return;
    const timer = window.setTimeout(advanceSlide, current.slideDuration ?? 5000);
    return () => window.clearTimeout(timer);
  }, [advanceSlide, current, isVideoSlide, paused, preview, reducedMotion, slides.length]);

  useEffect(() => {
    if (preview || slides.length < 2) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft")
        setActive((index) =>
          current?.loopSlides === false
            ? Math.max(0, index - 1)
            : (index - 1 + slides.length) % slides.length,
        );
      if (event.key === "ArrowRight")
        setActive((index) =>
          current?.loopSlides === false
            ? Math.min(slides.length - 1, index + 1)
            : (index + 1) % slides.length,
        );
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current?.loopSlides, preview, slides.length]);

  if (!current) {
    return preview ? (
      <div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div>
          <ImageOff className="mx-auto text-slate-300" size={36} />
          <p className="mt-4 font-bold text-slate-700">
            Hero preview is waiting for content
          </p>
          <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
            Add a title and image to see the saved homepage campaign preview.
          </p>
        </div>
      </div>
    ) : null;
  }

  function goTo(index: number) {
    if (slides.length < 2) return;
    setActive(
      current.loopSlides === false
        ? Math.max(0, Math.min(index, slides.length - 1))
        : (index + slides.length) % slides.length,
    );
  }

  const legacyAnimationName =
    animationNames[current.animationType as keyof typeof animationNames] ??
    animationNames.FADE;
  const imageAnimationName =
    preview && current.animationType
      ? legacyAnimationName
      : (imageAnimationNames[design.heroImageAnimation] ?? "hero-subtle-zoom");
  const transitionDuration = reducedMotion
    ? 0
    : (current.transitionDuration ?? 650);
  const image = slideImage(current);
  const mobile = mobileImage(current);
  const failed = failedImages[current.id];
  const textClass =
    alignment[(current.textAlignment ?? "LEFT") as keyof typeof alignment] ??
    alignment.LEFT;
  const positionClass =
    position[(current.contentPosition ?? "CENTER") as keyof typeof position] ??
    position.CENTER;
  const objectPosition = (current.backgroundPosition ?? "CENTER")
    .toLowerCase()
    .replaceAll("_", " ");
  const currentRecord = current as unknown as Record<string, unknown>;
  const title = localizedField(currentRecord, "title", locale) ?? current.title;
  const subtitle =
    localizedField(currentRecord, "subtitle", locale) ?? current.subtitle;
  const description =
    localizedField(currentRecord, "description", locale) ?? current.description;
  const buttonText =
    localizedField(currentRecord, "buttonText", locale) ?? current.buttonText;
  const secondaryButtonText =
    localizedField(currentRecord, "secondaryButtonText", locale) ??
    current.secondaryButtonText;
  const customLabel =
    localizedField(currentRecord, "customLabel", locale) ?? current.customLabel;
  const transitionClass =
    transitionNames[design.heroTransition] ?? "hero-transition-fade";
  const typewriterGraphic = current.layoutVariant === "TYPEWRITER_GRAPHIC";
  // Once metadata is available this is the exact media duration. Keeping the
  // typewriter on that same clock prevents a long video from being replaced
  // while its text animation is still running.
  const typewriterDuration = isVideoSlide
    ? (current.typingSpeedMs === 0 ? 0 : mediaDurationMs)
    : Math.max(0, current.typingSpeedMs ?? 52) * Math.max(title.length, 1);

  return (
    <div
      key={`${current.id}-${activeIndex}`}
      className={`relative isolate overflow-hidden border text-[var(--color-text-primary)] ${typewriterGraphic ? "hero-reference-banner" : ""} ${transitionClass} ${preview ? "min-h-[420px] rounded-2xl" : "min-h-[520px] rounded-none border-x-0 lg:rounded-2xl lg:border-x"}`}
      data-media-duration-ms={mediaDurationMs}
      style={
        {
          backgroundColor: typewriterGraphic
            ? (current.backgroundColor ?? "#F8F6F1")
            : "var(--color-background)",
          borderColor: "var(--color-border)",
          "--hero-transition-duration": `${transitionDuration}ms`,
          "--hero-media-duration": `${mediaDurationMs}ms`,
        } as CSSProperties
      }
      onMouseEnter={() => current.pauseOnHover !== false && setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={`absolute inset-y-0 right-0 hidden w-[47%] lg:block ${typewriterGraphic ? "bg-white/45" : "bg-[var(--color-primary-light)]"}`}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-primary) 10%, transparent)",
        }}
      >
        <div
          className="h-full transition-[width]"
          style={{
            width: `${((activeIndex + 1) / slides.length) * 100}%`,
            transitionDuration: `${transitionDuration}ms`,
            backgroundColor: "var(--color-secondary)",
          }}
        />
      </div>
      <div
        className={`relative mx-auto grid min-h-[520px] max-w-7xl lg:grid-cols-[1.03fr_.97fr] ${positionClass}`}
      >
        <div
          key={`${current.id}-content-${activeIndex}`}
          className={`relative z-10 flex flex-col justify-center px-6 py-14 sm:px-10 lg:px-14 lg:py-20 ${textClass}`}
          style={{
            animationDuration: `${preview ? transitionDuration : design.textDuration}ms`,
            animationDelay: `${preview ? 0 : design.textDelay}ms`,
            animationTimingFunction: design.animationEasing,
          }}
        >
          {customLabel && (
            <span
              className="mb-5 inline-flex rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--color-primary)]"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                backgroundColor:
                  "color-mix(in srgb, var(--color-primary) 5%, transparent)",
              }}
            >
              {customLabel}
            </span>
          )}
          {subtitle && (
            <AnimatedText
              text={subtitle}
              animation={reducedMotion ? "NONE" : "FADE_UP"}
              duration={design.textDuration}
              delay={(preview ? 0 : design.textDelay) + 60}
              easing={design.animationEasing}
              className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--color-secondary)]"
            />
          )}
          {title && (
            <h1
              className={`hero-title ${typewriterGraphic ? "text-slate-950" : "text-[var(--color-primary-dark)]"}`}
              aria-label={title}
            >
              {typewriterGraphic && !reducedMotion ? (
                <TypewriterText
                  key={`${current.id}-${activeVisit}-${title}`}
                  text={title}
                  duration={typewriterDuration}
                  delay={preview ? 0 : design.textDelay}
                  className="hero-title"
                />
              ) : design.heroTextAnimation === "TYPEWRITER" &&
                !reducedMotion ? (
                <TypewriterText
                  text={title}
                  duration={isVideoSlide ? typewriterDuration : design.textDuration}
                  delay={preview ? 0 : design.textDelay}
                  className="hero-title"
                />
              ) : (
                <AnimatedText
                  text={title}
                  animation={reducedMotion ? "NONE" : design.heroTextAnimation}
                  duration={preview ? transitionDuration : design.textDuration}
                  delay={preview ? 0 : design.textDelay}
                  easing={design.animationEasing}
                  className="hero-title"
                />
              )}
            </h1>
          )}
          {description && (
            <AnimatedText
              text={description}
              animation={reducedMotion ? "NONE" : "FADE_UP"}
              duration={design.textDuration}
              delay={(preview ? 0 : design.textDelay) + 150}
              easing={design.animationEasing}
              className="mt-5 block max-w-xl text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg"
            />
          )}
          {((buttonText && (current.buttonUrl ?? current.destination)) ||
            (secondaryButtonText && current.secondaryButtonUrl)) && (
            <div
              className="motion-fade-up mt-8 flex flex-wrap gap-3"
              style={{
                animationDelay: `${(preview ? 0 : design.textDelay) + 240}ms`,
                animationDuration: `${design.textDuration}ms`,
                animationTimingFunction: design.animationEasing,
              }}
            >
              {buttonText && (current.buttonUrl ?? current.destination) && (
                <Link
                  href={current.buttonUrl ?? current.destination ?? "/products"}
                  className={`${typewriterGraphic ? "hero-reference-cta" : "site-primary-button"} inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-extrabold shadow-sm transition`}
                >
                  {buttonText}
                  <ArrowRight size={16} />
                </Link>
              )}
              {secondaryButtonText && current.secondaryButtonUrl && (
                <Link
                  href={current.secondaryButtonUrl}
                  className="site-secondary-button inline-flex h-11 items-center gap-2 rounded-lg border bg-[var(--color-background)] px-5 text-sm font-bold text-[var(--color-primary)] transition"
                >
                  {secondaryButtonText}
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          )}
          {trendingProducts.length > 0 && (
            <div className="mt-8 w-full max-w-xl text-left">
              <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-secondary)]">Trending products</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {trendingProducts.slice(0, 3).map((product) => (
                  <Link key={product.id} href={`/products/${product.slug}`} className="group flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 p-2 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:bg-white">
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-50"><img src={resolveMediaUrl(product.imageUrls?.[0] ?? product.imageUrl)} alt="" onError={(event) => { const image = event.currentTarget; if (image.dataset.fallback) return; image.dataset.fallback = "true"; image.src = "/catalog-placeholder.svg"; }} className="h-full w-full object-contain p-1 mix-blend-multiply" /></span>
                    <span className="min-w-0"><span className="block truncate text-[11px] font-extrabold text-slate-800 group-hover:text-[var(--color-primary)]">{product.name}</span>{product.pricesVisible !== false && Number.isFinite(product.sellingPrice) && product.sellingPrice > 0 && <span className="mt-0.5 block text-[10px] font-bold text-slate-500">NPR {product.sellingPrice.toLocaleString("en-NP")}</span>}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <div
          className={`relative flex min-h-[300px] items-center justify-center overflow-hidden px-6 py-10 sm:px-12 lg:min-h-[520px] lg:px-14 ${typewriterGraphic ? "lg:order-last" : ""}`}
        >
          {video && !failedVideo ? (
            <div
              key={videoKey}
              className={`relative z-10 block w-full max-w-2xl ${!reducedMotion ? "hero-image-float" : ""}`}
            >
              <HeroVideo
                src={video}
                poster={mobile ?? image}
                title={title || "Homepage campaign"}
                reducedMotion={reducedMotion}
                autoplay={current.autoplayEnabled !== false}
                onDuration={(durationSeconds) => {
                  // HTMLMediaElement.duration is always reported in seconds,
                  // including videos that are several minutes long.
                  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
                    setVideoDurations((previous) =>
                      previous[videoKey] === durationSeconds
                        ? previous
                        : { ...previous, [videoKey]: durationSeconds },
                    );
                  }
                }}
                onError={() =>
                  setFailedVideos((previous) => ({
                    ...previous,
                    [videoKey]: true,
                  }))
                }
              />
            </div>
          ) : image && !failed ? (
            <picture
              key={`${current.id}-${activeIndex}`}
              className={`relative z-10 flex max-h-[520px] max-w-full items-center justify-center ${!reducedMotion ? "hero-image-float" : ""}`}
            >
              <source media="(max-width: 767px)" srcSet={mobile ?? image} />
              <img
                src={image}
                alt={title || "Homepage campaign"}
                className={`block h-auto max-h-[520px] w-auto max-w-full object-contain ${design.heroImageAnimation === "KEN_BURNS" ? "hero-ken-burns-active" : ""}`}
                style={{
                  objectPosition,
                  animationName: reducedMotion ? "none" : imageAnimationName,
                  animationDuration: `${preview ? transitionDuration : design.imageDuration}ms`,
                  animationDelay: `${preview ? 0 : design.imageDelay}ms`,
                  animationTimingFunction: design.animationEasing,
                  animationFillMode: "both",
                }}
                onError={() =>
                  setFailedImages((previous) => ({
                    ...previous,
                    [current.id]: true,
                  }))
                }
              />
            </picture>
          ) : (
            <div className="relative z-10 grid min-h-56 w-full max-w-md place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
              <div>
                <ImageOff className="mx-auto text-slate-300" size={36} />
                <p className="mt-3 text-sm font-bold text-slate-600">
                  Campaign image unavailable
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  The saved campaign content is still available.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {slides.length > 1 && current.showNavigationArrows !== false && (
        <div className="pointer-events-none absolute inset-x-3 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between sm:inset-x-5">
          <Button
            aria-label="Previous hero slide"
            title="Previous hero slide"
            variant="outline"
            size="icon"
            onClick={() => goTo(activeIndex - 1)}
            className="pointer-events-auto rounded-full border-slate-200 bg-white/95 text-[#003893] shadow-sm hover:bg-[#003893] hover:text-white"
          >
            <ArrowLeft />
          </Button>
          <Button
            aria-label="Next hero slide"
            title="Next hero slide"
            variant="outline"
            size="icon"
            onClick={() => goTo(activeIndex + 1)}
            className="pointer-events-auto rounded-full border-slate-200 bg-white/95 text-[#003893] shadow-sm hover:bg-[#003893] hover:text-white"
          >
            <ArrowRight />
          </Button>
        </div>
      )}
      {slides.length > 1 && current.showPaginationDots !== false && (
        <div
          className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-2"
          role="tablist"
          aria-label="Homepage hero slides"
        >
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-label={`Show slide ${index + 1}`}
              aria-selected={activeIndex === index}
              onClick={() => goTo(index)}
              className={`h-2 rounded-full transition-all ${activeIndex === index ? "w-8 bg-[#DC143C]" : "w-2 bg-slate-300"}`}
            />
          ))}
        </div>
      )}
      {slides.length > 1 && (
        <div className="absolute right-6 top-6 z-20 text-xs font-extrabold tracking-[0.16em] text-slate-400 sm:right-10 sm:top-8">
          {String(activeIndex + 1).padStart(2, "0")}{" "}
          <span className="mx-1 text-slate-300">/</span>{" "}
          {String(slides.length).padStart(2, "0")}
        </div>
      )}
    </div>
  );
}
