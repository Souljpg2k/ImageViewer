import "./App.css";
import { useRef, useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";


function App() {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0, rot: 0 });
  const resetView = () => setView({ zoom: 1, x: 0, y: 0, rot: 0 });
  const rotate = (deg: number) => setView((v) => ({ ...v, rot: v.rot + deg }));
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const path = images[currentIndex];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.shiftKey && e.code === "KeyP") {
        setView({ zoom: 1, x: 0, y: 0, rot: 0 });
      } else if (!e.shiftKey && e.code === "KeyQ") {
        setView((v) => ({ ...v, rot: v.rot - 90 }));
      } else if (!e.shiftKey && e.code === "KeyE") {
        setView((v) => ({ ...v, rot: v.rot + 90 }));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!path) return;
    let ok = true;
    setDim(null);
    setSize(null);
    invoke<number>("file_size", { path })
      .then((s) => ok && setSize(s))
      .catch(console.error);
    return () => { ok = false; };
  }, [path]);

  const fmt = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

  async function openImage() {
    const file = await open({
      multiple: true,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "gif"],
        },
      ],
    });
    if (!file) return;

    const files = Array.isArray(file) ? file : [file];

    if (files.length === 1) {
      try {
        const list = (await invoke<string[]>("list_images", { file: files[0] })).sort(
          (a, b) => a.localeCompare(b, undefined, { numeric: true })
        );
        setImages(list);
        setCurrentIndex(Math.max(0, list.indexOf(files[0])));
        return;
      } catch (err) {
        console.error(err);
      }
    }
    setImages(files);
    setCurrentIndex(0);
  }

  const go = (d: number) => {
    setCurrentIndex((i) => (i + d + images.length) % images.length);
    resetView();
  };

  function handleWheel(e: React.WheelEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;

    setView((v) => {
      const next = Math.min(5, Math.max(0.2, v.zoom * factor));
      const k = next / v.zoom;
      return { ...v, zoom: next, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }

  function handlePointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }

  function endDrag() {
    drag.current = null;
    setDragging(false);
  }

  return (
    <>
      <section className="tab">
        <div className="tab-btn">
          <span className="material-symbols-outlined" onClick={() => resetView()}>restart_alt</span>
          <span>|</span>
          <span className="material-symbols-outlined" onClick={() => rotate(-90)}>rotate_90_degrees_ccw</span>
          <span className="material-symbols-outlined" onClick={() => rotate(90)}>rotate_90_degrees_cw</span>
        </div>
        <div className="tab-btn">
          {images.length > 0 ? currentIndex + 1 : 0} / {images.length}
        </div>
        <div className="tab-btn">
          <span className="material-symbols-outlined" onClick={openImage}>folder_open</span>
          <span>|</span>
          <span className="material-symbols-outlined" onClick={() => setShowInfo((s) => !s)}>info</span>
        </div>
      </section>

      {path && (
        <aside className={`info ${showInfo ? "open" : ""}`}>
          <div>
            <span className="material-symbols-outlined">info</span>
            <p>info</p>
          </div>
          <div>
            <span className="material-symbols-outlined">description</span>
            {path.split(/[\\/]/).pop()}
          </div>
          <div>
            <span className="material-symbols-outlined">aspect_ratio</span>
            {dim ? `${dim.w} × ${dim.h}` : "…"}
          </div>
          <div>
            <span className="material-symbols-outlined">hard_drive</span>
            {size != null ? fmt(size) : "…"}
          </div>
        </aside>
      )}

      {images.length > 1 && (
        <>
          <div className="prevImage">
            <span className="material-symbols-outlined" onClick={() => go(-1)}>arrow_back_ios</span>
          </div>
          <div className="nextImage">
            <span className="material-symbols-outlined" onClick={() => go(1)}>arrow_forward_ios</span>
          </div>
        </>
      )}

      <main className="container"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        {!images.length && (
          <section className="viewer">
            <h2>ImageViewer</h2>
            <button className="open-btn" onClick={openImage}>Open Image</button>
          </section>
        )}

        <section className="image" onWheel={handleWheel}>
          {images.length > 0 && (
            <img
              src={convertFileSrc(images[currentIndex])}
              alt={`Image ${currentIndex + 1}`}
              draggable={false}
              onLoad={(e) =>
                setDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
              }
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom}) rotate(${view.rot}deg)`,
                transition: dragging ? "none" : undefined,
              }}
            />
          )}
        </section>
      </main>
    </>
  );
}

export default App;