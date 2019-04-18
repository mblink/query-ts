import { fromNullable, Option, option } from "fp-ts/lib/Option";
import * as Cookie from "js-cookie";
import { CommonRouter } from "./routes/commonRouter";
import { Alert } from "./ui/alert";
import { Bondlink } from "./bondlink";
import { Q, QCustomEvent } from "./dom/q";
import { Form } from "./form/form";
import { lockForm } from "./form/formUtil";
import { hasKey } from "./util/hasKey";
import { invoke2 } from "./util/invoke";
import { html } from "./dom/unsafeHtml";
import { liftA2 } from "fp-ts/lib/Apply";
import { eq } from "./util/eq";

const optEq = <A>(o1: Option<A>, o2: Option<A>): boolean =>
  liftA2(option)(eq)(o1)(o2).getOrElseL(() => o1.isNone() && o2.isNone());

export class User {
  static readonly jsSessionCookieName = "JS_SESSION";
  static readonly logoutNotificationId = "logout-notification";
  static logoutNotificationTimeout: number;

  static initLogoutNotification(): void {
    User._logoutNotification(fromNullable(Cookie.get(User.jsSessionCookieName)));
    Q.body.listen(Form.beforeSendEvent, (e: QCustomEvent) =>
      fromNullable(e.getAttr("detail"))
        .filter(hasKey<"url", string>("url"))
        .filter((x: { url: string; }) =>
          x.url === CommonRouter.common.UserController.login(<string>(<unknown>undefined)).url
            || x.url === CommonRouter.common.UserController.logout().url
            || x.url === CommonRouter.common.UserController.passwordResetPost().url)
        .map(User.stopLogoutNotification));
  }

  static stopLogoutNotification(): void {
    clearTimeout(User.logoutNotificationTimeout);
  }

  static _logoutNotification(initialValue: Option<string>): void {
    const c = fromNullable(Cookie.get(User.jsSessionCookieName));
    if (!optEq(initialValue, c) && Q.one(`#${User.logoutNotificationId}`).isNone()) {
      Alert.show(User.logoutNotificationId, "alert-warning",
        html`You have ${initialValue.isNone() ? "logged in" : c.isNone() ? "logged out" : "switched accounts"} from another tab or window.
          <a href="javascript:history.go(0);">Refresh</a> the page to reload your session.`,
        0);
      Q.all("form").forEach(lockForm);
    }
    User.logoutNotificationTimeout = setTimeout(() => User._logoutNotification(c), 500);
  }

  static logIn(): void {
    window.location.href = Bondlink.config.baseUrl + CommonRouter.common.UserController.login(window.location.pathname).url;
  }

  static logOut(): void {
    const form = Q.createElement("form", [invoke2("setData")("action", CommonRouter.common.UserController.logout().url)], []);
    Q.body.append(form);
    form.trigger("submit");
  }
}
