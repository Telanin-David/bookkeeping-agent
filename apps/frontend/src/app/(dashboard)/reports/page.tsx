import PageWrapper from '@/components/layout/PageWrapper';
import ReportForm from '@/components/reports/ReportForm';

export default function ReportsPage() {
  return (
    <PageWrapper title="Reports">
      <div className="max-w-md">
        <p className="mb-6 text-sm text-gray-500">
          Generate PDF reports for your shop. Select a report type and date range, then download.
        </p>
        <ReportForm />
      </div>
    </PageWrapper>
  );
}
