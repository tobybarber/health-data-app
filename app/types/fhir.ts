/**
 * FHIR Resource Types
 * Based on FHIR R4 Resource definitions
 * See: https://www.hl7.org/fhir/resourcelist.html
 */

// Base Resource Type
export interface Resource {
  resourceType: string;
  id?: string;
  meta?: Meta;
}

export interface Meta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: Coding[];
  tag?: Coding[];
}

export interface Coding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Reference {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
}

export interface Identifier {
  use?: string;
  type?: CodeableConcept;
  system?: string;
  value?: string;
  period?: Period;
  assigner?: Reference;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface Quantity {
  value?: number;
  comparator?: string;
  unit?: string;
  system?: string;
  code?: string;
}

export interface Range {
  low?: Quantity;
  high?: Quantity;
}

// Patient Resource
export interface Patient extends Resource {
  resourceType: 'Patient';
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  gender?: string;
  birthDate?: string;
  address?: Address[];
  contact?: PatientContact[];
}

export interface HumanName {
  use?: string;
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: Period;
}

export interface ContactPoint {
  system?: string;
  value?: string;
  use?: string;
  rank?: number;
  period?: Period;
}

export interface Address {
  use?: string;
  type?: string;
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: Period;
}

export interface PatientContact {
  relationship?: CodeableConcept[];
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
  gender?: string;
  organization?: Reference;
  period?: Period;
}

// Observation Resource
export interface Observation extends Resource {
  resourceType: 'Observation';
  identifier?: Identifier[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueTime?: string;
  valueDateTime?: string;
  interpretation?: CodeableConcept[];
  note?: Annotation[];
  bodySite?: CodeableConcept;
  method?: CodeableConcept;
  specimen?: Reference;
  device?: Reference;
  referenceRange?: ObservationReferenceRange[];
  component?: ObservationComponent[];
}

export interface Ratio {
  numerator?: Quantity;
  denominator?: Quantity;
}

export interface Annotation {
  authorReference?: Reference;
  authorString?: string;
  time?: string;
  text: string;
}

export interface ObservationReferenceRange {
  low?: Quantity;
  high?: Quantity;
  type?: CodeableConcept;
  appliesTo?: CodeableConcept[];
  age?: Range;
  text?: string;
}

export interface ObservationComponent {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueTime?: string;
  valueDateTime?: string;
  interpretation?: CodeableConcept[];
  referenceRange?: ObservationReferenceRange[];
}

// DiagnosticReport Resource
export interface DiagnosticReport extends Resource {
  resourceType: 'DiagnosticReport';
  identifier?: Identifier[];
  basedOn?: Reference[];
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  performer?: Reference[];
  resultsInterpreter?: Reference[];
  specimen?: Reference[];
  result?: Reference[];
  imagingStudy?: Reference[];
  media?: DiagnosticReportMedia[];
  conclusion?: string;
  conclusionCode?: CodeableConcept[];
  presentedForm?: Attachment[];
}

export interface DiagnosticReportMedia {
  comment?: string;
  link: Reference;
}

export interface Attachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

// Bundle Resource for responses
export interface Bundle extends Resource {
  resourceType: 'Bundle';
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  total?: number;
  link?: BundleLink[];
  entry?: BundleEntry[];
}

export interface BundleLink {
  relation: string;
  url: string;
}

export interface BundleEntry {
  fullUrl?: string;
  resource?: Resource;
  search?: BundleEntrySearch;
  request?: BundleEntryRequest;
  response?: BundleEntryResponse;
}

export interface BundleEntrySearch {
  mode?: 'match' | 'include' | 'outcome';
  score?: number;
}

export interface BundleEntryRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  ifMatch?: string;
  ifNoneExist?: string;
}

export interface BundleEntryResponse {
  status: string;
  location?: string;
  etag?: string;
  lastModified?: string;
  outcome?: Resource;
}

// Common FHIR search parameters
export interface FHIRSearchParams {
  _id?: string;
  _lastUpdated?: string;
  _tag?: string;
  _profile?: string;
  _security?: string;
  _text?: string;
  _content?: string;
  _list?: string;
  _has?: string;
  _type?: string;
  _sort?: string;
  _count?: string;
  _include?: string;
  _revinclude?: string;
  _summary?: string;
  _elements?: string;
  _contained?: string;
  _containedType?: string;
  [key: string]: string | undefined;
}

// Medication Resource
export interface Medication extends Resource {
  resourceType: 'Medication';
  identifier?: Identifier[];
  code?: CodeableConcept;
  status?: 'active' | 'inactive' | 'entered-in-error';
  manufacturer?: Reference;
  form?: CodeableConcept;
  amount?: Ratio;
  ingredient?: MedicationIngredient[];
  batch?: MedicationBatch;
}

export interface MedicationIngredient {
  itemCodeableConcept?: CodeableConcept;
  itemReference?: Reference;
  isActive?: boolean;
  strength?: Ratio;
}

export interface MedicationBatch {
  lotNumber?: string;
  expirationDate?: string;
}

// MedicationStatement Resource
export interface MedicationStatement extends Resource {
  resourceType: 'MedicationStatement';
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status: 'active' | 'completed' | 'entered-in-error' | 'intended' | 'stopped' | 'on-hold' | 'unknown' | 'not-taken';
  statusReason?: CodeableConcept[];
  category?: CodeableConcept;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  subject: Reference;
  context?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  dateAsserted?: string;
  informationSource?: Reference;
  derivedFrom?: Reference[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  note?: Annotation[];
  dosage?: Dosage[];
}

export interface Dosage {
  sequence?: number;
  text?: string;
  additionalInstruction?: CodeableConcept[];
  patientInstruction?: string;
  timing?: Timing;
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: CodeableConcept;
  site?: CodeableConcept;
  route?: CodeableConcept;
  method?: CodeableConcept;
  doseAndRate?: DosageDoseAndRate[];
  maxDosePerPeriod?: Ratio;
  maxDosePerAdministration?: Quantity;
  maxDosePerLifetime?: Quantity;
}

export interface DosageDoseAndRate {
  type?: CodeableConcept;
  doseRange?: Range;
  doseQuantity?: Quantity;
  rateRatio?: Ratio;
  rateRange?: Range;
  rateQuantity?: Quantity;
}

export interface Timing {
  event?: string[];
  repeat?: TimingRepeat;
  code?: CodeableConcept;
}

export interface TimingRepeat {
  boundsDuration?: Quantity;
  boundsRange?: Range;
  boundsPeriod?: Period;
  count?: number;
  countMax?: number;
  duration?: number;
  durationMax?: number;
  durationUnit?: string;
  frequency?: number;
  frequencyMax?: number;
  period?: number;
  periodMax?: number;
  periodUnit?: string;
  dayOfWeek?: string[];
  timeOfDay?: string[];
  when?: string[];
  offset?: number;
}

// Condition Resource
export interface Condition extends Resource {
  resourceType: 'Condition';
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  category?: CodeableConcept[];
  severity?: CodeableConcept;
  code?: CodeableConcept;
  bodySite?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: Quantity;
  onsetPeriod?: Period;
  onsetRange?: Range;
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: Quantity;
  abatementPeriod?: Period;
  abatementRange?: Range;
  abatementString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  stage?: ConditionStage[];
  evidence?: ConditionEvidence[];
  note?: Annotation[];
}

export interface ConditionStage {
  summary?: CodeableConcept;
  assessment?: Reference[];
  type?: CodeableConcept;
}

export interface ConditionEvidence {
  code?: CodeableConcept[];
  detail?: Reference[];
}

// AllergyIntolerance Resource
export interface AllergyIntolerance extends Resource {
  resourceType: 'AllergyIntolerance';
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: ('food' | 'medication' | 'environment' | 'biologic')[];
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: Quantity;
  onsetPeriod?: Period;
  onsetRange?: Range;
  onsetString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  lastOccurrence?: string;
  note?: Annotation[];
  reaction?: AllergyIntoleranceReaction[];
}

export interface AllergyIntoleranceReaction {
  substance?: CodeableConcept;
  manifestation: CodeableConcept[];
  description?: string;
  onset?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  exposureRoute?: CodeableConcept;
  note?: Annotation[];
}

// Immunization Resource
export interface Immunization extends Resource {
  resourceType: 'Immunization';
  identifier?: Identifier[];
  status: 'completed' | 'entered-in-error' | 'not-done';
  statusReason?: CodeableConcept;
  vaccineCode: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  occurrenceDateTime?: string;
  occurrenceString?: string;
  recorded?: string;
  primarySource?: boolean;
  reportOrigin?: CodeableConcept;
  location?: Reference;
  manufacturer?: Reference;
  lotNumber?: string;
  expirationDate?: string;
  site?: CodeableConcept;
  route?: CodeableConcept;
  doseQuantity?: Quantity;
  performer?: ImmunizationPerformer[];
  note?: Annotation[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  isSubpotent?: boolean;
  subpotentReason?: CodeableConcept[];
  education?: ImmunizationEducation[];
  programEligibility?: CodeableConcept[];
  fundingSource?: CodeableConcept;
  reaction?: ImmunizationReaction[];
  protocolApplied?: ImmunizationProtocolApplied[];
}

export interface ImmunizationPerformer {
  function?: CodeableConcept;
  actor: Reference;
}

export interface ImmunizationEducation {
  documentType?: string;
  reference?: string;
  publicationDate?: string;
  presentationDate?: string;
}

export interface ImmunizationReaction {
  date?: string;
  detail?: Reference;
  reported?: boolean;
}

export interface ImmunizationProtocolApplied {
  series?: string;
  authority?: Reference;
  targetDisease?: CodeableConcept[];
  doseNumberPositiveInt?: number;
  doseNumberString?: string;
  seriesDosesPositiveInt?: number;
  seriesDosesString?: string;
}

// DocumentReference Resource
export interface DocumentReference extends Resource {
  resourceType: 'DocumentReference';
  identifier?: Identifier[];
  status: 'current' | 'superseded' | 'entered-in-error';
  docStatus?: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
  type?: CodeableConcept;
  category?: CodeableConcept[];
  subject?: Reference;
  date?: string;
  author?: Reference[];
  authenticator?: Reference;
  custodian?: Reference;
  relatesTo?: DocumentReferenceRelatesTo[];
  description?: string;
  securityLabel?: CodeableConcept[];
  content: DocumentReferenceContent[];
  context?: DocumentReferenceContext;
}

export interface DocumentReferenceRelatesTo {
  code: 'replaces' | 'transforms' | 'signs' | 'appends';
  target: Reference;
}

export interface DocumentReferenceContent {
  attachment: Attachment;
  format?: Coding;
}

export interface DocumentReferenceContext {
  encounter?: Reference[];
  event?: CodeableConcept[];
  period?: Period;
  facilityType?: CodeableConcept;
  practiceSetting?: CodeableConcept;
  sourcePatientInfo?: Reference;
  related?: Reference[];
}

// Procedure Resource
export interface Procedure extends Resource {
  resourceType: 'Procedure';
  identifier?: Identifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status: 'preparation' | 'in-progress' | 'completed' | 'entered-in-error' | 'stopped' | 'unknown';
  statusReason?: CodeableConcept;
  category?: CodeableConcept;
  code?: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  performedDateTime?: string;
  performedPeriod?: Period;
  performedString?: string;
  performedAge?: Quantity;
  performedRange?: Range;
  recorder?: Reference;
  asserter?: Reference;
  performer?: ProcedurePerformer[];
  location?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  bodySite?: CodeableConcept[];
  outcome?: CodeableConcept;
  report?: Reference[];
  complication?: CodeableConcept[];
  complicationDetail?: Reference[];
  followUp?: CodeableConcept[];
  note?: Annotation[];
  focalDevice?: ProcedureFocalDevice[];
  usedReference?: Reference[];
  usedCode?: CodeableConcept[];
}

export interface ProcedurePerformer {
  function?: CodeableConcept;
  actor: Reference;
  onBehalfOf?: Reference;
}

export interface ProcedureFocalDevice {
  action?: CodeableConcept;
  manipulated: Reference;
}

// FamilyMemberHistory Resource
export interface FamilyMemberHistory extends Resource {
  resourceType: 'FamilyMemberHistory';
  identifier?: Identifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  status: 'partial' | 'completed' | 'entered-in-error' | 'health-unknown' | 'not-done';
  dataAbsentReason?: CodeableConcept;
  patient: Reference;
  date?: string;
  name?: string;
  relationship: CodeableConcept;
  sex?: CodeableConcept;
  bornPeriod?: Period;
  bornDate?: string;
  bornString?: string;
  ageAge?: Quantity;
  ageRange?: Range;
  ageString?: string;
  estimatedAge?: boolean;
  deceasedBoolean?: boolean;
  deceasedAge?: Quantity;
  deceasedRange?: Range;
  deceasedDate?: string;
  deceasedString?: string;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  note?: Annotation[];
  condition?: FamilyMemberHistoryCondition[];
}

export interface FamilyMemberHistoryCondition {
  code: CodeableConcept;
  outcome?: CodeableConcept;
  contributedToDeath?: boolean;
  onsetAge?: Quantity;
  onsetRange?: Range;
  onsetPeriod?: Period;
  onsetString?: string;
  note?: Annotation[];
}

// ImagingStudy Resource for radiological imaging
export interface ImagingStudy extends Resource {
  resourceType: 'ImagingStudy';
  identifier?: Identifier[];
  status: 'registered' | 'available' | 'cancelled' | 'entered-in-error' | 'unknown';
  modality?: Coding[];
  subject: Reference;
  encounter?: Reference;
  started?: string;
  basedOn?: Reference[];
  referrer?: Reference;
  interpreter?: Reference[];
  endpoint?: Reference[];
  numberOfSeries?: number;
  numberOfInstances?: number;
  procedureReference?: Reference;
  procedureCode?: CodeableConcept[];
  location?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  note?: Annotation[];
  description?: string;
  series?: ImagingStudySeries[];
}

export interface ImagingStudySeries {
  uid: string;
  number?: number;
  modality: Coding;
  description?: string;
  numberOfInstances?: number;
  endpoint?: Reference[];
  bodySite?: Coding;
  laterality?: Coding;
  specimen?: Reference[];
  started?: string;
  performer?: ImagingStudyPerformer[];
  instance?: ImagingStudyInstance[];
}

export interface ImagingStudyPerformer {
  function?: CodeableConcept;
  actor: Reference;
}

export interface ImagingStudyInstance {
  uid: string;
  sopClass: Coding;
  number?: number;
  title?: string;
}

// Extend DiagnosticReport to include Imaging specifics
export interface DiagnosticReportImaging extends DiagnosticReport {
  category?: CodeableConcept[];
  imagingStudy?: Reference[];
  media?: DiagnosticReportMedia[];
} 