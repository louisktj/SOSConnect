
import React from 'react';
import { SosReport } from '../types';

interface SosReportCardProps {
  report: SosReport;
  translation: string;
}

const SosReportCard: React.FC<SosReportCardProps> = ({ report, translation }) => {
  return (
    <div className="bg-red-900/50 border border-red-700 p-4 rounded-lg shadow-lg">
      <h3 className="text-2xl font-bold text-red-300 mb-3">EMERGENCY REPORT</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
        <div>
          <strong className="text-red-400 block">Context:</strong>
          <p>{report.context}</p>
        </div>
        <div>
          <strong className="text-red-400 block">Danger Type:</strong>
          <p className="font-mono bg-red-800/50 px-2 py-1 rounded inline-block">{report.danger_type}</p>
        </div>
        <div>
          <strong className="text-red-400 block">Location:</strong>
          <p>{report.location_details}</p>
        </div>
        <div>
          <strong className="text-red-400 block">Immediate Needs:</strong>
          <ul className="list-disc list-inside">
            {report.user_needs.map((need, index) => <li key={index}>{need}</li>)}
          </ul>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-red-700">
        <strong className="text-red-400 block mb-1">Full Translation for Local Authorities:</strong>
        <p className="text-sm text-gray-200 whitespace-pre-wrap">{translation}</p>
      </div>
    </div>
  );
};

export default SosReportCard;
