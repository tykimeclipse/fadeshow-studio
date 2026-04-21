import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

function App() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideDuration, setSlideDuration] = useState(3);
  const [transitionType, setTransitionType] = useState("crossfade");
  const [transitionDuration, setTransitionDuration] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHandleDimmed, setIsHandleDimmed] = useState(false);

  const transitionTimeoutRef = useRef(null);
  const handleDimTimeoutRef = useRef(null);
  const shellRef = useRef(null);

  const imageModules = import.meta.glob("./assets/images/*.{png,jpg,jpeg,webp,avif,gif,svg}", {
    eager: true,
    import: "default",
  });

  const slides = useMemo(() => {
    return Object.entries(imageModules)
      .sort(([pathA], [pathB]) =>
        pathA.localeCompare(pathB, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      )
      .map(([path, src], index) => {
        const fileName = path.split("/").pop() || `slide-${index + 1}`;
        return {
          id: index + 1,
          src,
          alt: fileName,
          fileName,
        };
      });
  }, [imageModules]);

  const currentSlide = slides[currentIndex] ?? null;
  const previousSlide =
    previousIndex !== null && slides[previousIndex]
      ? slides[previousIndex]
      : null;

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }, []);

  const clearHandleDimTimer = useCallback(() => {
    if (handleDimTimeoutRef.current) {
      window.clearTimeout(handleDimTimeoutRef.current);
      handleDimTimeoutRef.current = null;
    }
  }, []);

  const startHandleDimTimer = useCallback(() => {
    clearHandleDimTimer();

    if (isPanelOpen) {
      setIsHandleDimmed(false);
      return;
    }

    handleDimTimeoutRef.current = window.setTimeout(() => {
      setIsHandleDimmed(true);
    }, 2500);
  }, [clearHandleDimTimer, isPanelOpen]);

  const wakeHandle = useCallback(() => {
    if (isPanelOpen) return;
    setIsHandleDimmed(false);
    startHandleDimTimer();
  }, [isPanelOpen, startHandleDimTimer]);

  const beginTransitionTo = (nextIndex) => {
  if (!slides.length) return;
  if (nextIndex === currentIndex) return;

  clearTransitionTimer();

  if (transitionType === "none" || transitionDuration <= 0) {
    setPreviousIndex(null);
    setIsTransitioning(false);
    setCurrentIndex(nextIndex);
    return;
  }

  setIsTransitioning(false);
  setPreviousIndex(currentIndex);
  setCurrentIndex(nextIndex);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setIsTransitioning(true);
    });
  });

  const safeTransitionMs =
    Math.max(0, Number(transitionDuration) || 0) * 1000;

  transitionTimeoutRef.current = window.setTimeout(() => {
    setIsTransitioning(false);
    setPreviousIndex(null);
    transitionTimeoutRef.current = null;
  }, safeTransitionMs);
};

  const goToNext = useCallback(() => {
    if (!slides.length) return;
    const nextIndex = (currentIndex + 1) % slides.length;
    beginTransitionTo(nextIndex);
  }, [beginTransitionTo, currentIndex, slides.length]);

  const goToPrev = useCallback(() => {
    if (!slides.length) return;
    const nextIndex = (currentIndex - 1 + slides.length) % slides.length;
    beginTransitionTo(nextIndex);
  }, [beginTransitionTo, currentIndex, slides.length]);

  const togglePlay = useCallback(() => {
    if (!slides.length) return;
    setIsPlaying((prev) => !prev);
  }, [slides.length]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await shellRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("전체화면 전환 실패:", error);
    }
  }, []);

  useEffect(() => {
    if (!slides.length) return;
    if (!isPlaying) return;

    const safeDuration = Math.max(1, Number(slideDuration) || 3);
    const intervalId = window.setInterval(() => {
      const nextIndex = (currentIndex + 1) % slides.length;
      beginTransitionTo(nextIndex);
    }, safeDuration * 1000);

    return () => window.clearInterval(intervalId);
  }, [beginTransitionTo, currentIndex, isPlaying, slideDuration, slides.length]);

  useEffect(() => {
    if (!slides.length) {
      setCurrentIndex(0);
      setPreviousIndex(null);
      setIsPlaying(false);
      return;
    }

    if (currentIndex > slides.length - 1) {
      setCurrentIndex(0);
      setPreviousIndex(null);
    }
  }, [currentIndex, slides.length]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (isPanelOpen) {
      clearHandleDimTimer();
      setIsHandleDimmed(false);
      return;
    }

    startHandleDimTimer();

    return () => {
      clearHandleDimTimer();
    };
  }, [clearHandleDimTimer, isPanelOpen, startHandleDimTimer]);

  useEffect(() => {
    const isTypingTarget = (target) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName;
      return (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;
      if (event.repeat) return;

      wakeHandle();

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrev();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNext();
        return;
      }

      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goToNext, goToPrev, toggleFullscreen, togglePlay, wakeHandle]);

  useEffect(() => {
    return () => {
      clearTransitionTimer();
      clearHandleDimTimer();
    };
  }, [clearHandleDimTimer, clearTransitionTimer]);

  const stageClassName = [
    "slide-surface",
    transitionType === "fade" ? "mode-fade" : "",
    transitionType === "crossfade" ? "mode-crossfade" : "",
    transitionType === "none" ? "mode-none" : "",
    isTransitioning ? "is-transitioning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const transitionStyle = {
    "--transition-duration": `${Math.max(
      0,
      Number(transitionDuration) || 0
    )}s`,
  };

  return (
    <div className="app">
      <main ref={shellRef} className="slideshow-shell">
        <section
          className="slide-stage"
          onClick={() => {
            if (isPanelOpen) setIsPanelOpen(false);
          }}
          onMouseMove={wakeHandle}
        >
          <div className={stageClassName} style={transitionStyle}>
            {slides.length === 0 ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "20px",
                }}
              >
                src/assets/images 폴더에 이미지를 넣어 주세요.
              </div>
            ) : (
              <>
                {previousSlide && (
                  <img
                    className="slide-image slide-image-previous"
                    src={previousSlide.src}
                    alt={previousSlide.alt}
                  />
                )}
                <img
                  className="slide-image slide-image-current"
                  src={currentSlide.src}
                  alt={currentSlide.alt}
                />
              </>
            )}
          </div>
        </section>

        <button
          type="button"
          className={`panel-handle ${isPanelOpen ? "is-hidden" : ""} ${
            isHandleDimmed ? "is-dimmed" : ""
          }`}
          onClick={() => setIsPanelOpen(true)}
          onMouseEnter={wakeHandle}
          onMouseMove={wakeHandle}
          aria-label="설정 패널 열기"
        >
          설정
        </button>

        <aside
          className={`settings-drawer ${isPanelOpen ? "is-open" : ""}`}
          onClick={(e) => e.stopPropagation()}
          onMouseMove={() => setIsHandleDimmed(false)}
        >
          <div className="drawer-header">
            <div>
              <h2>설정</h2>
              <p>슬라이드쇼 동작을 조정합니다.</p>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setIsPanelOpen(false)}
              aria-label="설정 패널 닫기"
            >
              닫기
            </button>
          </div>

          <div className="drawer-section">
            <h3>재생 설정</h3>

            <label className="field">
              <span>전환 효과</span>
              <select
                value={transitionType}
                onChange={(e) => setTransitionType(e.target.value)}
              >
                <option value="crossfade">크로스페이드</option>
                <option value="fade">페이드</option>
                <option value="none">없음</option>
              </select>
            </label>

            <label className="field">
              <span>슬라이드 표시 시간(초)</span>
              <input
                type="number"
                min="1"
                step="1"
                value={slideDuration}
                onChange={(e) => setSlideDuration(Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span>전환 시간(초)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={transitionDuration}
                onChange={(e) => setTransitionDuration(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="drawer-section">
            <h3>컨트롤</h3>
            <div className="button-group">
              <button
                className="primary-button"
                type="button"
                onClick={togglePlay}
              >
                {isPlaying ? "일시정지" : "재생"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={goToPrev}
              >
                이전
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={goToNext}
              >
                다음
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? "전체화면 종료" : "전체화면"}
              </button>
            </div>
          </div>

          <div className="drawer-section">
            <h3>단축키</h3>
            <p className="help-text">
              스페이스바: 재생/일시정지
              <br />
              ← / → : 이전 / 다음
              <br />
              F : 전체화면
            </p>
          </div>

          <div className="drawer-section">
            <h3>상태</h3>
            <p className="help-text">
              현재 상태: {isPlaying ? "자동재생 중" : "일시정지"} / 슬라이드{" "}
              {slides.length === 0 ? 0 : currentIndex + 1} / {slides.length} /{" "}
              {isFullscreen ? "전체화면" : "일반화면"}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;