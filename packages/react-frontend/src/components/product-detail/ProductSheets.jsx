import Sheet from "../Sheet.jsx";
import { DEMO_NOW } from "../../data/mock.js";
import { ageLabel, countNoun, money } from "../../lib/format.js";

export function StalePriceSheet({ row, product, onClose, onShowFresh }) {
  if (!row) return null;
  return <Sheet title="This price is old" onClose={onClose}><p>{row.store.name} last checked {product.name} {ageLabel(row.updated_at, DEMO_NOW)}. The price may have changed.</p><div className="actions"><button type="button" className="btn primary" onClick={onShowFresh}>Show fresh prices</button><button type="button" className="btn ghost" onClick={onClose}>Keep browsing</button></div></Sheet>;
}

export function AddToListSheet({ open, lists, items, listId, quantity, existing, onClose, onListChange, onQuantityChange, onSave }) {
  if (!open) return null;
  return <Sheet title="Add to list" onClose={onClose}>{lists.length === 0 ? <p>Create a list on the List tab first.</p> : <><div className="stack">{lists.map((list) => { const count = items.filter((item) => item.list_id === list.id).length; return <label key={list.id} className="choice"><input type="radio" name="list" checked={listId === list.id} onChange={() => onListChange(list.id)} /><span><strong>{list.name}</strong><span className="muted"> {countNoun(count, "item")}</span></span></label>; })}</div><div className="stepper"><span>Quantity</span><button type="button" aria-label="Decrease quantity" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>-</button><strong>{quantity}</strong><button type="button" aria-label="Increase quantity" onClick={() => onQuantityChange(Math.min(99, quantity + 1))}>+</button></div><button type="button" className="btn primary" onClick={onSave}>{existing ? "Update" : "Add to"} {lists.find((list) => list.id === listId)?.name}</button></>}</Sheet>;
}

export function PriceAlertSheet({ open, product, location, quote, fallbackPrice, saved, onClose, onSave }) {
  if (!open) return null;
  const below = quote?.unit ?? fallbackPrice;
  return <Sheet title="Price alert" onClose={onClose}><p>Save an alert for {product.name} near {location?.zip}. We will flag it on this device if the lowest fresh price drops below {money(below)}.</p><button type="button" className="btn primary sheet-btn" onClick={() => onSave(below)}>{saved ? "Update alert" : "Save alert"}</button></Sheet>;
}
