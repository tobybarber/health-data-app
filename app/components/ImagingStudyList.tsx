'use client';

import React, { useState } from 'react';
import { ImagingStudy, DiagnosticReportImaging } from '../types/fhir';
import { formatDate } from '../utils/date-utils';

interface ImagingStudyListProps {
  imagingStudies: ImagingStudy[];
  imagingReports?: DiagnosticReportImaging[];
  onViewStudy?: (study: ImagingStudy) => void;
  onViewReport?: (report: DiagnosticReportImaging) => void;
}

export function ImagingStudyList({
  imagingStudies,
  imagingReports = [],
  onViewStudy,
  onViewReport
}: ImagingStudyListProps) {
  if (!imagingStudies || imagingStudies.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        No imaging studies found.
      </div>
    );
  }

  // Map reports to imaging studies (if provided)
  const reportsByStudyId = imagingReports.reduce((map, report) => {
    // Find any imaging study references
    if (report.imagingStudy && report.imagingStudy.length > 0) {
      for (const reference of report.imagingStudy) {
        // Extract study ID from the reference
        const studyId = reference.reference?.split('/')[1];
        if (studyId) {
          if (!map[studyId]) {
            map[studyId] = [];
          }
          map[studyId].push(report);
        }
      }
    }
    return map;
  }, {} as Record<string, DiagnosticReportImaging[]>);

  return (
    <div className="space-y-6">
      {imagingStudies.map((study) => (
        <ImagingStudyCard
          key={study.id}
          study={study}
          reports={study.id ? reportsByStudyId[study.id] || [] : []}
          onViewStudy={onViewStudy}
          onViewReport={onViewReport}
        />
      ))}
    </div>
  );
}

interface ImagingStudyCardProps {
  study: ImagingStudy;
  reports: DiagnosticReportImaging[];
  onViewStudy?: (study: ImagingStudy) => void;
  onViewReport?: (report: DiagnosticReportImaging) => void;
}

function ImagingStudyCard({
  study,
  reports,
  onViewStudy,
  onViewReport
}: ImagingStudyCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Get study description
  const description = study.description || 'Imaging Study';

  // Get modality from first series
  const modality = study.modality?.[0]?.display ||
                  (study.series && study.series.length > 0) ?
                    study.series?.[0]?.modality?.display : 'Unknown';

  // Get start date
  const startDate = study.started ?
    formatDate(new Date(study.started)) :
    'Unknown date';

  // Get number of series and instances
  const seriesCount = study.numberOfSeries || (study.series?.length || 0);
  const instanceCount = study.numberOfInstances || 0;

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm">
      {/* Study header */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium">{description}</h3>
            <p className="text-sm text-gray-500">
              {modality} • {startDate}
            </p>
          </div>
          <div className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
            {seriesCount} {seriesCount === 1 ? 'Series' : 'Series'} • {instanceCount} {instanceCount === 1 ? 'Image' : 'Images'}
          </div>
        </div>

        {/* Study actions */}
        <div className="mt-2 flex items-center justify-between">
          <div>
            {study.series && study.series.length > 0 && (
              <button
                className="text-sm text-blue-600 hover:text-blue-800 font-medium mr-4"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Hide Series' : 'Show Series'}
              </button>
            )}
            
            {onViewStudy && (
              <button
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => onViewStudy(study)}
              >
                Study Details
              </button>
            )}
          </div>
          
          {/* Display badge if there are associated reports */}
          {reports.length > 0 && (
            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
              {reports.length} {reports.length === 1 ? 'Report' : 'Reports'} Available
            </span>
          )}
        </div>
      </div>

      {/* Series list (expandable) */}
      {expanded && study.series && study.series.length > 0 && (
        <div className="px-4 py-2 border-b">
          <h4 className="text-sm font-medium mb-2">Series</h4>
          <div className="space-y-2">
            {study.series.map((series, index) => (
              <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                <div className="flex justify-between">
                  <div className="font-medium">
                    {series.description || `Series ${series.number}`}
                  </div>
                  <div className="text-gray-500">
                    {series.numberOfInstances || series.instance?.length || 0} Images
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {series.modality?.display || series.modality?.code || 'Unknown modality'}
                  {series.bodySite && ` • ${series.bodySite.display || series.bodySite.code}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related reports */}
      {reports.length > 0 && (
        <div className="p-4">
          <h4 className="text-sm font-medium mb-2">Reports</h4>
          <div className="space-y-2">
            {reports.map((report) => (
              <div 
                key={report.id} 
                className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                onClick={() => onViewReport && onViewReport(report)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">
                      {report.code?.text || 'Imaging Report'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {report.effectiveDateTime ? 
                        formatDate(new Date(report.effectiveDateTime)) : 
                        'Unknown date'}
                    </div>
                  </div>
                  <div className="px-2 py-1 rounded text-xs bg-gray-100">
                    {report.status === 'final' ? 'Final' : report.status}
                  </div>
                </div>
                
                {report.conclusion && (
                  <div className="mt-1 text-xs text-gray-700 line-clamp-2">
                    {report.conclusion}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 