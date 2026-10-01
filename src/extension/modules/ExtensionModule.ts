import type {
  FeatureId,
} from "../../shared/features";

export interface ExtensionModule {
  id: FeatureId;

  start: () => void;

  stop: () => void;
}