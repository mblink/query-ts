import autobind from "autobind-decorator";
import Clipboard from "clipboard";
import { array, findFirst, findIndex, zip } from "fp-ts/lib/Array";
import { constVoid, not, pipe } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { fromFoldable, lookup, toArray } from "fp-ts/lib/Record";
import { getLastSemigroup } from "fp-ts/lib/Semigroup";
import { JumpLinks } from "../../../sites/assets/scripts/jumpLinks";
import { Modal as ModalComp } from "../ui/modal";
import { Table } from "../ui/table";
import { CachedElements } from "../util/cachedElements";
import { eq } from "../util/eq";
import { invoke0, invoke1, invoke2 } from "../util/invoke";
import { Log } from "../util/log";
import { merge } from "../util/merge";
import { prop } from "../util/prop";
import { Q, QEvent } from "./q";
import { getWindowSize } from "./window";

@autobind
abstract class DeepLinkType {
  separator = "~";

  abstract re: RegExp;
  abstract reMatchNames: string[];
  abstract linkBuilders: { [selector: string]: (el: Q) => string };

  abstract match(m: { [k: string]: string }): boolean;
  abstract process(m: { [k: string]: string }): void;

  protected mkRe(prefix: string, suffix?: string): RegExp {
    return new RegExp(`^${prefix}${this.separator}([A-Za-z][a-zA-Z0-9\-_:\.]+)${fromNullable(suffix).fold("", (s: string) => `${this.separator}${s}`)}$`);
  }
}

@autobind
export class Modal extends DeepLinkType {
  re = this.mkRe("modal");
  reMatchNames = ["modalId"];
  linkBuilders = {
    [`${Modal.toggle(none)}`]: (btn: Q) =>
      `modal${this.separator}${CachedElements.normalizeId(btn.getData("target").getOrElse(""))}`,
    [`${ModalComp.toggleSelector}[href]:not([data-target])`]: (link: Q) =>
      `modal${this.separator}${CachedElements.normalizeId(link.getAttrO("href").getOrElse(""))}`
  };

  static dataTarget = (base: string, id: Option<string>) => `${base}[data-target${id.fold("", (s: string) => `="${s}"`)}]`;
  static toggle = (id: Option<string>) => Modal.dataTarget(ModalComp.toggleSelector, id);

  // If it matches the regex, it's all good
  match(): boolean { return true; }

  process(m: { [k: string]: string }): void {
    ModalComp.showById(m.modalId);
  }
}

@autobind
export class DataTable extends DeepLinkType {
  re = this.mkRe("dt", `([a-zA-Z0-9]+)(${this.separator}([a-zA-Z0-9]+))?`);
  reMatchNames = ["dtId", "rowId", "_", "action"];
  linkBuilders = {
    ".table tbody tr": (row: Q) => `dt${this.separator}${this.dtAndRowIds(row).getOrElse("")}`,
    '.table td[data-action]:not([data-action="delete"])': (cell: Q) =>
      `dt${this.separator}${this.dtAndRowIds(cell).getOrElse("")}${this.separator}${cell.getData("action").getOrElse("")}`
  };

  // If it matches the regex, it's all good
  match(): boolean { return true; }

  process(m: Record<string, string>): void {
    const id = `${m.dtId}-${m.rowId}`;
    Q.one(`#${m.dtId}`).chain(Table.cache.get).map((table: Table) =>
      findIndex(table.dataTable.data, pipe(prop("id"), eq(id))).map((rowIdx: number) => {
        table.paginateTo(Math.max(1, Math.ceil(rowIdx / Table.pageSize)), false);
        Q.waitFor(() => Q.one(`#${id}`).map(invoke0("isVisible")).getOrElse(false))
          .then(() => Q.one(`#${id}`).map((row: Q) => {
            setTimeout(() => {
              JumpLinks.jumpTo(row, none);
              row.addClass("highlight-primary");
              setTimeout(() => row.removeClass("highlight-primary"), 5000);
            }, 100);

            lookup("action", m).filter(not(eq("delete"))).chain((a: string) =>
              row.one(`td[data-action="${a}"]:not([data-action="delete"])`).map((actionEl: Q) => {
                // TODO - support calling actions on elements
                Log.info("Calling action on element", actionEl);
              })
            );
          }))
          .catch(() => Log.warn("DeepLink", "Row never became visible"));
      }));
  }

  private dtAndRowIds(el: Q): Option<string> {
    return el.closest(".table").chain(Table.cache.get).map((table: Table) =>
      `${table.dataTable.element.getAttr("id")}${this.separator}${table.getRowIdFromTarget(el).getOrElse("")}`);
  }
}

// This should always come last because it has the loosest checks
@autobind
class Any extends DeepLinkType {
  re = /^([A-Za-z][a-zA-Z0-9\-_:\.]+)$/;
  reMatchNames = ["id"];
  linkBuilders = {};

  match(m: { [k: string]: string }): boolean { return Q.one(`#${m.id}`).isSome(); }
  process(m: { [k: string]: string }): void {
    Q.one(`#${m.id}`).map((e: Q) => JumpLinks.jumpTo(e, Q.one(`.jump-link a[href="#${m.id}"]`)));
  }
}

const deepLinkTypes: DeepLinkType[] = [new Modal(), new DataTable(), new Any()];

interface Builders { [selector: string]: (e: Q) => string; }

export class DeepLink {
  static init(): void {
    DeepLink.initMatch();
    DeepLink.initLinkBuilders();
  }

  static initMatch(): void {
    findFirst(deepLinkTypes, DeepLink.tryMatch).map((dlt: DeepLinkType) =>
      Log.info("DeepLink", "Initialized deep link", window.location.hash, dlt));
  }

  static initLinkBuilders(): void {
    DeepLink.bindLinkBuilders(deepLinkTypes.reduce((acc: Builders, dlt: DeepLinkType) =>
      merge(acc)(dlt.linkBuilders), <Builders>{}));
  }

  private static tryMatch(dlt: DeepLinkType): boolean {
    return fromNullable(window.location.hash.slice(1).match(dlt.re))
      .filter((rm: RegExpMatchArray) => rm.length - 1 === dlt.reMatchNames.length)
      .map((rm: RegExpMatchArray) => fromFoldable(array)(
        zip(dlt.reMatchNames, rm.slice(1, dlt.reMatchNames.length + 1)), getLastSemigroup<string>().concat))
      .filter(dlt.match)
      .map((m: { [k: string]: string }) => { dlt.process(m); return true; })
      .getOrElse(false);
  }

  private static ctxMenu(hash: string): Q {
    const url = `${location.protocol}//${location.host}${location.pathname}#${hash}`;
    const mkA = (aAttrs: ((e: Q<HTMLAnchorElement>) => Q<HTMLAnchorElement>)[], text: string) =>
      Q.createElement("a", aAttrs.concat([invoke1("addClass")("ctx-link"), invoke1("setInnerText")(text)]), []);
    return Q.createElement("div", [invoke2("setAttrUnsafe")("id", "ctx-menu")], [
      mkA([
        invoke2("setAttrUnsafe")("href", "javascript:void(0)"),
        invoke1("addClass")("copy-text"),
        invoke2("setData")("clipboard-text", url)
      ], "Copy Deep Link"),
      mkA([
        invoke2("setAttrUnsafe")("href", url),
        invoke2("setAttrUnsafe")("target", "_blank")
      ], "Open Deep Link")
    ]);
  }

  private static bindLinkBuilders(builders: Builders): void {
    let menu: Option<Q> = none;
    const removeCtxMenu = () => { menu.map(invoke0("remove")); };
    (new Clipboard("#ctx-menu .copy-text")).on("success", removeCtxMenu);

    Q.body.listen("contextmenu", Object.keys(builders).join(", "), (e: QEvent<"contextmenu">) => {
      if (!e.getAttr("altKey")) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      removeCtxMenu();
      findFirst(toArray(builders), pipe(prop(0), e.selectedElement.matches)).map(([_, builder]: [string, (e: Q) => string]) => {
        const newMenu = DeepLink.ctxMenu(builder(e.selectedElement));
        menu = some(newMenu);
        const pageX = e.getAttr("pageX");
        const menuWidth = newMenu.getWidthWithMargin();
        newMenu.setInlineStyles({
          position: "absolute",
          top: `${e.getAttr("pageY")}px`,
          left: `${(pageX + menuWidth) >= getWindowSize().width ? pageX - menuWidth : pageX}px`
        });
        Q.body.append(newMenu);
      });
    });

    Q.body.listen("click", (e: QEvent) => e.selectedElement.closest("#ctx-menu").foldL(removeCtxMenu, constVoid));
  }
}
