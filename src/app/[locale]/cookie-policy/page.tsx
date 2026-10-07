import { legalPage } from '../_legal/LegalPage';

/** The old storefront's /cookie-policy: the legal page the admin flagged as cookies. */
const page = legalPage('cookies');
export const generateMetadata = page.generateMetadata;
export default page.LegalPage;
export const dynamic = 'force-dynamic';
