import React from "react";

// AddItemModal.tsx
export function AddItemModal({
  show,
  onClose,
  onAdd
}: {
  show: boolean;
  onClose: () => void;
  onAdd: (name: string, qty: string, unit: string) => void;
}) {
  const [newItemName, setNewItemName] = React.useState('');
  const [newItemQty, setNewItemQty] = React.useState('');
  const [newItemUnit, setNewItemUnit] = React.useState('');

  const handleAdd = () => {
    if (!newItemName.trim()) return;
    onAdd(newItemName, newItemQty, newItemUnit);
    setNewItemName('');
    setNewItemQty('');
    setNewItemUnit('');
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl transform transition-all" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-2xl font-bold mb-5 text-gray-800">הוסף פריט</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="שם המוצר"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="כמות"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
              className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base"
            />
            <input
              type="text"
              placeholder="יחידה (גרם, ק״ג...)"
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
              className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAdd}
              disabled={!newItemName.trim()}
              className={`flex-1 px-6 py-3 rounded-xl font-bold text-base transition-all ${
                newItemName.trim()
                  ? 'bg-gradient-to-l from-rose-400 to-pink-400 text-white hover:shadow-lg active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              הוסף
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-base transition-all active:scale-95"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}