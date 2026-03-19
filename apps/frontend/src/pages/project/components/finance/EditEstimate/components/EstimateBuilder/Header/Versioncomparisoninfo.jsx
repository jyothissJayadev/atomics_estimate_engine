import React, { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  PlusCircle,
  MinusCircle,
  RefreshCcw,
  History,
  ArrowRight,
} from "lucide-react";
import {
  calculateSubtotal,
  calculateGrandTotal,
} from "../../../utils/calculations";

const formatCurrency = (val) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);

export const VersionComparisonInfo = ({
  selectedVersion,
  activeVersion,
  gstPercentage = 18,
}) => {
  if (!selectedVersion || !activeVersion) return null;

  const comparison = useMemo(() => {
    const previousCategories = selectedVersion.categories || [];
    const currentCategories = activeVersion.categories || [];

    const buildItemMap = (categories) => {
      const map = new Map();
      categories.forEach((cat) => {
        (cat.phases || []).forEach((item) => {
          const total = Object.keys(item)
            .filter((k) => k.includes("_total") || k === "total")
            .reduce((sum, key) => sum + (Number(item[key]) || 0), 0);

          map.set(item._id, {
            id: item._id,
            categoryName: cat.name,
            rowName: item.name || item.title || "Untitled Row",
            total,
          });
        });
      });
      return map;
    };

    const previousMap = buildItemMap(previousCategories);
    const currentMap = buildItemMap(currentCategories);

    const changes = [];

    // Check Removed + Modified
    previousMap.forEach((prevItem, id) => {
      if (!currentMap.has(id)) {
        changes.push({
          ...prevItem,
          type: "removed",
          from: prevItem.total,
          to: 0,
        });
      } else {
        const currentItem = currentMap.get(id);
        if (prevItem.total !== currentItem.total) {
          changes.push({
            ...currentItem,
            type: "modified",
            from: prevItem.total,
            to: currentItem.total,
          });
        }
      }
    });

    // Check Added
    currentMap.forEach((currItem, id) => {
      if (!previousMap.has(id)) {
        changes.push({
          ...currItem,
          type: "added",
          from: 0,
          to: currItem.total,
        });
      }
    });

    const previousSubtotal = calculateSubtotal(previousCategories);
    const currentSubtotal = calculateSubtotal(currentCategories);

    return {
      changes,
      previousTotal: calculateGrandTotal(previousSubtotal, gstPercentage),
      currentTotal: calculateGrandTotal(currentSubtotal, gstPercentage),
    };
  }, [selectedVersion, activeVersion, gstPercentage]);

  const { changes, previousTotal, currentTotal } = comparison;
  const totalDiff = currentTotal - previousTotal;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md mb-8 overflow-hidden">
      {/* HEADER SECTION */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <History size={20} className="text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Version Comparison
            </h3>
            <p className="text-xs text-slate-500">
              Comparing v{selectedVersion.version} with Active Version
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-slate-400">
              Difference
            </p>
            <div
              className={`flex items-center gap-1 font-bold ${totalDiff >= 0 ? "text-rose-600" : "text-emerald-600"}`}
            >
              {totalDiff > 0 ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              {formatCurrency(Math.abs(totalDiff))}
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 border-b border-slate-100">
        <div className="p-6 border-r border-slate-100 bg-slate-50/30">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
            Previous Total (v{selectedVersion.version})
          </p>
          <p className="text-xl font-semibold text-slate-600">
            {formatCurrency(previousTotal)}
          </p>
        </div>
        <div className="p-6 bg-white">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
            Current Active Total
          </p>
          <p className="text-xl font-bold text-slate-900">
            {formatCurrency(currentTotal)}
          </p>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="p-0">
        {changes.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[11px] uppercase text-slate-500 font-bold border-b border-slate-100">
                <th className="px-6 py-3">Category / Item</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Price Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {changes.map((item, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="text-[10px] font-bold text-orange-500 uppercase">
                      {item.categoryName}
                    </p>
                    <p className="text-sm font-medium text-slate-700">
                      {item.rowName}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge type={item.type} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{formatCurrency(item.from)}</span>
                        <ArrowRight size={12} />
                        <span className="font-bold text-slate-700">
                          {formatCurrency(item.to)}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-bold ${item.to - item.from > 0 ? "text-rose-500" : "text-emerald-500"}`}
                      >
                        {item.to - item.from > 0 ? "+" : ""}
                        {formatCurrency(item.to - item.from)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <p className="text-slate-400 italic">
              No line-item changes detected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Component for Status Tags
const StatusBadge = ({ type }) => {
  const styles = {
    added: "bg-emerald-50 text-emerald-700 border-emerald-100",
    removed: "bg-rose-50 text-rose-700 border-rose-100",
    modified: "bg-amber-50 text-amber-700 border-amber-100",
  };

  const icons = {
    added: <PlusCircle size={12} />,
    removed: <MinusCircle size={12} />,
    modified: <RefreshCcw size={12} />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${styles[type]}`}
    >
      {icons[type]}
      {type}
    </span>
  );
};
