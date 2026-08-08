import { useId, useState } from "react";
import ImageViewer from "./ImageViewer";
import type { InspectionRegion } from "@/lib/adapter";

const TEXT_COLOR = "#535861";

/**
 * Model-inspection figure (FE-8, PRD-07/PRD-08).
 *
 * Locked behaviour:
 *  - the overlay defaults OFF and is labelled model inspection
 *  - hiding it does not change the next step, which lives outside this figure
 *  - the caption is persistent and non-causal
 *  - a text alternative describes the regions for anyone not reading the image
 *
 * PROVISIONAL: region labels are bare ordinals. ARCH-4 owns the imaging finding
 * vocabulary and the confidence semantics; until it is signed, nothing here may
 * name a finding, and nothing here may be described as validated or
 * model-backed in the UI or the pitch.
 */

export const INSPECTION_CAPTION =
  "Highlighted areas show where the model looked. They do not explain the result, do not indicate what was found, and are not a measurement.";

export default function InspectionFigure({
  src,
  regions,
}: {
  src: string;
  regions: readonly InspectionRegion[];
}) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [opacity, setOpacity] = useState(0.5);
  const toggleId = useId();
  const sliderId = useId();
  const altTextId = useId();

  const hasRegions = regions.length > 0;

  return (
    <figure className="mt-6 w-full">
      <figcaption className="mb-2">
        <h3 className="text-sm font-bold" style={{ color: TEXT_COLOR }}>
          Model inspection
        </h3>
        <p
          className="mt-1 text-sm leading-relaxed"
          style={{ color: TEXT_COLOR, opacity: 0.75 }}
        >
          {INSPECTION_CAPTION}
        </p>
      </figcaption>

      <ImageViewer
        src={src}
        alt="The ultrasound image you submitted."
        overlay={
          showOverlay && hasRegions ? (
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {regions.map((region) => (
                <div
                  key={region.id}
                  className="absolute rounded-sm border-2 border-white"
                  style={{
                    left: `${region.x * 100}%`,
                    top: `${region.y * 100}%`,
                    width: `${region.width * 100}%`,
                    height: `${region.height * 100}%`,
                    opacity,
                  }}
                >
                  <span className="absolute -top-0.5 left-0 -translate-y-full bg-white/90 px-1 text-[10px] font-medium text-neutral-900">
                    {region.label}
                  </span>
                </div>
              ))}
            </div>
          ) : null
        }
      />

      <div className="mt-3 space-y-3 rounded-xl border border-border p-3">
        <div className="flex items-center gap-3">
          <input
            id={toggleId}
            type="checkbox"
            checked={showOverlay}
            disabled={!hasRegions}
            onChange={(e) => setShowOverlay(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-neutral-700 disabled:opacity-40"
          />
          <label
            htmlFor={toggleId}
            className="text-sm font-medium"
            style={{ color: TEXT_COLOR }}
          >
            Show model inspection overlay
          </label>
        </div>

        {!hasRegions && (
          <p className="text-sm" style={{ color: TEXT_COLOR, opacity: 0.58 }}>
            No inspection output was produced for this image.
          </p>
        )}

        {showOverlay && hasRegions && (
          <div className="flex items-center gap-3">
            <label
              htmlFor={sliderId}
              className="text-sm whitespace-nowrap"
              style={{ color: TEXT_COLOR }}
            >
              Overlay opacity
            </label>
            <input
              id={sliderId}
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="h-9 flex-1 accent-neutral-700 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
            <span className="w-10 text-right text-xs text-muted-foreground">
              {Math.round(opacity * 100)}%
            </span>
          </div>
        )}
      </div>

      {hasRegions && (
        <details className="mt-3">
          <summary
            className="cursor-pointer text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            style={{ color: TEXT_COLOR }}
          >
            Describe the highlighted areas in text
          </summary>
          <div id={altTextId} className="mt-2">
            <p
              className="text-sm leading-relaxed"
              style={{ color: TEXT_COLOR, opacity: 0.75 }}
            >
              {regions.length} area{regions.length === 1 ? "" : "s"} of the image
              were highlighted. Positions are described relative to the image
              frame.
            </p>
            <ul className="mt-2 space-y-1">
              {regions.map((region) => (
                <li
                  key={region.id}
                  className="text-sm leading-relaxed"
                  style={{ color: TEXT_COLOR, opacity: 0.75 }}
                >
                  {region.label}: {describePosition(region)}, covering roughly{" "}
                  {Math.round(region.width * region.height * 100)}% of the frame.
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </figure>
  );
}

/** Plain-language position, so the figure is usable without seeing it. */
function describePosition(region: InspectionRegion): string {
  const centreX = region.x + region.width / 2;
  const centreY = region.y + region.height / 2;

  const horizontal =
    centreX < 0.34 ? "left" : centreX > 0.66 ? "right" : "centre";
  const vertical =
    centreY < 0.34 ? "upper" : centreY > 0.66 ? "lower" : "middle";

  if (horizontal === "centre" && vertical === "middle") return "centre of the image";
  if (horizontal === "centre") return `${vertical} centre of the image`;
  if (vertical === "middle") return `${horizontal} of the image`;
  return `${vertical} ${horizontal} of the image`;
}
