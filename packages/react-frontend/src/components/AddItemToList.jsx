import { useState } from "react";
import { Link } from "react-router-dom";
import Sheet from "./Sheet.jsx";
import { useAppState } from "../state/useAppState.js";

export default function AddItemToList({ product, request }) {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const [listId, setListId] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          setListId(
            state.activeListId || state.lists[0]?.id || ""
          );
          setOpen(true);
        }}>
        Add to list
      </button>
      {added ? (
        <p role="status">
          Added. <Link to="/list">View list</Link>
        </p>
      ) : null}
      {open ? (
        <Sheet
          title={`Add ${product?.name || request.name}`}
          onClose={() => setOpen(false)}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              const target = listId || state.createList(name);
              if (!target) return;
              if (product) {
                const existing = state.items.find(
                  (item) =>
                    item.list_id === target &&
                    item.product_id === product.id
                );
                state.addOrUpdateItem(
                  target,
                  product.id,
                  Math.min(
                    99,
                    (existing?.quantity || 0) + quantity
                  )
                );
              } else {
                state.addRequestedItem(target, request.query, {
                  ...request,
                  quantity
                });
                state.setActiveList(target);
              }
              setOpen(false);
              setAdded(true);
            }}>
            <label className="field">
              <span>Shopping list</span>
              <select
                value={listId}
                onChange={(event) =>
                  setListId(event.target.value)
                }>
                {state.lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
                <option value="">Create a new list</option>
              </select>
            </label>
            {!listId ? (
              <label className="field">
                <span>New list name</span>
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                />
              </label>
            ) : null}
            <label className="field">
              <span>Quantity</span>
              <input
                type="number"
                min="1"
                max="99"
                required
                value={quantity}
                onChange={(event) =>
                  setQuantity(Number(event.target.value))
                }
              />
            </label>
            <button type="submit" className="btn primary">
              Save to list
            </button>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}
