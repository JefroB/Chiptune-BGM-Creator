import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Info,
  Search,
  ExternalLink,
  Terminal
} from 'lucide-react';
import { PROTOCOL_CATALOG, ProtocolParameter } from '../data/protocolCatalog.ts';

export const ProtocolDocsView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterHardware, setFilterHardware] = useState<'ALL' | 'MIDInes' | 'MIDIbox SID'>('ALL');

  const filtered = PROTOCOL_CATALOG.filter((p) => {
    if (filterHardware !== 'ALL' && p.hardware !== filterHardware) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.paramName.toLowerCase().includes(q) ||
        p.citationSource.toLowerCase().includes(q) ||
        p.channelTarget.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-neutral-200">
      {/* Top Banner */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-[11px] font-bold">
              PROTOCOL EVIDENCE AUDIT
            </span>
            <span className="text-neutral-500 font-mono text-xs">ucapps.de & Wayfar 0xF00000 Documentation</span>
          </div>
          <h2 className="text-lg font-bold text-white">Hardware Protocol Catalog & Evidence Records</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Every MIDI CC, NRPN, and SysEx message is documented with its exact manual citation, valid data ranges,
            hardware scaling formulas, and verification status. Speculative or invented messages are strictly prohibited.
          </p>
        </div>

        {/* Search & Hardware Filter */}
        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs font-mono">
            {(['ALL', 'MIDInes', 'MIDIbox SID'] as const).map((hw) => (
              <button
                key={hw}
                onClick={() => setFilterHardware(hw)}
                className={`px-3 py-1 rounded transition ${
                  filterHardware === hw
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {hw}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Protocol Table */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400">
                <th className="py-2.5 px-3">Hardware</th>
                <th className="py-2.5 px-3">Parameter Name</th>
                <th className="py-2.5 px-3">Type & Address</th>
                <th className="py-2.5 px-3">Target Voice / Channel</th>
                <th className="py-2.5 px-3">Range & Scaling</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Documentation Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-800/30">
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.hardware === 'MIDInes'
                          ? 'bg-red-950 text-red-300 border border-red-800'
                          : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      }`}
                    >
                      {item.hardware}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-bold text-white">
                    {item.paramName}
                  </td>

                  <td className="py-3 px-3 text-emerald-400">
                    {item.encoding.toUpperCase()}{' '}
                    {item.encoding === 'cc' ? `CC ${item.controllerOrAddress}` : `0x${item.controllerOrAddress.toString(16)}`}
                  </td>

                  <td className="py-3 px-3 text-neutral-300">
                    {item.channelTarget}
                  </td>

                  <td className="py-3 px-3 text-neutral-400 font-sans text-[11px]">
                    <div>{item.validRange.min} - {item.validRange.max}</div>
                    <div className="text-neutral-500 text-[10px]">{item.hardwareScaleDescription}</div>
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.status === 'VERIFIED_PHYSICAL'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {item.status === 'VERIFIED_PHYSICAL' ? 'VERIFIED' : 'PROVISIONAL'}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-neutral-400 font-sans text-[11px]">
                    <div>{item.citationSource}</div>
                    <div className="text-neutral-500 text-[10px]">{item.notes}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
