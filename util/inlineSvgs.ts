import { Q } from "../dom/q";
import { none, Option } from "fp-ts/lib/Option";
import { UnsafeHtml } from "../dom/unsafeHtml";
import { lookup } from "fp-ts/lib/Record";
import { tap } from "./tap";

export const inlineSvgs = () => {
  type SVGPromise = Promise<Option<Q<SVGElement>>>;
  const cache: Record<string, SVGPromise> = {};

  const replaceImg = (img: Q<HTMLImageElement>) => (svgO: Option<Q<SVGElement>>) => svgO.map((_svg: Q<SVGElement>) => {
    const svg = _svg.clone();
    [].slice.call(img.getAttr("attributes"))
      .filter((attr: Attr) => attr.name !== "src")
      .forEach((attr: Attr) => svg.setAttrUnsafe(attr.name, attr.value));
    img.replaceWith(svg);
  });

  Q.all<HTMLImageElement>('img[src$=".svg"]:not(.no-inline)').forEach((img: Q<HTMLImageElement>) =>
    lookup(img.getAttr("src"), cache).getOrElseL(() =>
      tap((p: SVGPromise) => cache[img.getAttr("src")] = p)(fetch(img.getAttr("src")).then((res: Response) =>
        res.ok ? res.text().then((s: string) => Q.parseFragment(UnsafeHtml(s), "image/svg+xml")) : none)))
    .then(replaceImg(img)));
};
