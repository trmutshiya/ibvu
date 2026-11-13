// IBVU v6.04 — new file. Shows a picture the way it was framed in admin
// (moved, zoomed in). The picture always fills its box. See src/lib/frame.js.
// A picture with no framing is shown exactly as before: a plain <img>.
//
//   value     the saved picture (address, possibly with "#frame=…")
//   fallback  the built-in photo, used when no picture was chosen
//   ratio     for pictures that normally keep their own shape (article
//             covers, herb photos): the shape to use once they are framed
import { parseImage, frameStyles } from '../lib/frame.js';

export default function Framed({ value, fallback = "", alt = "", className, ratio, ...rest }) {
  const { src: own, frame, orig } = parseImage(value);
  const src = own || fallback;
  if (!src) return null;
  // No framing, or a ready-framed copy (newsletter covers): an ordinary picture.
  if (!frame || orig) return <img className={className} src={src} alt={alt} {...rest} />;
  const s = frameStyles(frame);
  // The size comes from the page's own styles (class on the frame); the
  // framing only decides what shows inside it.
  const outer = { ...s.outer };
  if (ratio) { outer.aspectRatio = String(ratio); outer.height = "auto"; }
  return (
    <span className={"framed" + (className ? " " + className : "")} style={outer} data-framed="">
      <span className="framed-move" style={s.move}>
        <img src={src} alt={alt} {...rest} style={s.img} />
      </span>
    </span>
  );
}
