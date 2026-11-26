import React from "react";
import {chinese, language, localLink} from "./locale.js";

// Localise presentation at the JSX boundary. Component inputs, keys, select
// values, data-series identifiers and financial calculations stay canonical.
export function localElement(type, props, ...children) {
  const host = typeof type === "string";
  if (host && type === "a" && props?.href?.startsWith("?"))
    props = {...props, href:localLink(props.href)};
  if ((host || type === React.Fragment) && language() === "zh-CN") {
    if (props) {
      const translated = {...props};
      for (const key of ["title", "aria-label", "placeholder", "alt", "data-label"])
        if (typeof props[key] === "string") translated[key] = chinese(props[key]);
      props = translated;
    }
    if (type === "option" && props?.value == null && typeof children[0] === "string")
      props = {...props, value:children[0]};
    children = children.map(value => typeof value === "string" ?
      (type === "button" && value === "Close" ? "关闭" : chinese(value)) : value);
  }
  return React.createElement(type, props, ...children);
}
