// Copyright 2020-2022 the Kubeapps contributors.
// SPDX-License-Identifier: Apache-2.0

import actions from "actions";
import Alert from "components/js/Alert";
import OperatorInstanceFormBody from "components/OperatorInstanceFormBody/OperatorInstanceFormBody";
import OperatorHeader from "components/OperatorView/OperatorHeader";
import { act } from "react-dom/test-utils";
import * as ReactRedux from "react-redux";
import { defaultStore, getStore, initialState, mountWrapper } from "shared/specs/mountWrapper";
import { FetchError, IClusterServiceVersion, IStoreState } from "shared/types";
import OperatorInstanceForm, { IOperatorInstanceFormProps } from "./OperatorInstanceForm";
import OperatorAdvancedDeploymentForm from "../OperatorInstanceFormBody/OperatorAdvancedDeploymentForm/OperatorAdvancedDeploymentForm";

const defaultProps: IOperatorInstanceFormProps = {
  csvName: "foo",
  crdName: "foo-cluster",
  cluster: initialState.config.kubeappsCluster,
  namespace: "kubeapps",
};

const defaultCRD = {
  name: defaultProps.crdName,
  kind: "Foo",
  description: "useful description",
} as any;

const defaultCSV = {
  metadata: {
    annotations: {
      "alm-examples": '[{"kind": "Foo", "apiVersion": "v1"}]',
    },
  },
  spec: {
    customresourcedefinitions: {
      owned: [defaultCRD],
    },
  },
} as any;

let spyOnUseDispatch: jest.SpyInstance;
const kubeActions = { ...actions.operators };
beforeEach(() => {
  // mock the window.matchMedia for selecting the theme
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // mock the window.ResizeObserver, required by the MonacoDiffEditor for the layout
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    })),
  });

  // mock the window.HTMLCanvasElement.getContext(), required by the MonacoDiffEditor for the layout
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation(() => ({
      clearRect: jest.fn(),
    })),
  });

  actions.operators = {
    ...actions.operators,
    getCSV: jest.fn(),
  };
  const mockDispatch = jest.fn(res => res);
  spyOnUseDispatch = jest.spyOn(ReactRedux, "useDispatch").mockReturnValue(mockDispatch);
});

afterEach(() => {
  actions.operators = { ...kubeActions };
  spyOnUseDispatch.mockRestore();
  jest.restoreAllMocks();
});

it("renders a fetch error", () => {
  const wrapper = mountWrapper(
    getStore({
      ...initialState,
      operators: {
        ...initialState.operators,
        errors: { ...initialState.operators.errors, csv: { fetch: new FetchError("Boom!") } },
      },
    } as Partial<IStoreState>),
    <OperatorInstanceForm {...defaultProps} />,
  );
  expect(wrapper.find(Alert)).toIncludeText("Boom!");
  expect(wrapper.find(OperatorHeader)).not.toExist();
});

it("renders a create error", () => {
  const wrapper = mountWrapper(
    getStore({
      operators: {
        csv: defaultCSV,
        errors: { resource: { create: new Error("Boom!") } },
      },
    } as Partial<IStoreState>),
    <OperatorInstanceForm {...defaultProps} />,
  );
  expect(wrapper.find(Alert)).toIncludeText("Boom!");
});

it("retrieves CSV when mounted", () => {
  const getCSV = jest.fn();
  actions.operators.getCSV = getCSV;
  mountWrapper(defaultStore, <OperatorInstanceForm {...defaultProps} />);
  expect(getCSV).toHaveBeenCalledWith(
    defaultProps.cluster,
    defaultProps.namespace,
    defaultProps.csvName,
  );
});

it("retrieves the example values and the target CRD from the given CSV", () => {
  const wrapper = mountWrapper(
    getStore({ operators: { csv: defaultCSV } } as Partial<IStoreState>),
    <OperatorInstanceForm {...defaultProps} />,
  );
  expect(wrapper.find(OperatorInstanceFormBody).props()).toMatchObject({
    defaultValues: 'kind: "Foo"\napiVersion: "v1"\n',
  });
});

it("defaults to empty defaultValues if the examples annotation is not found", () => {
  const csv = {
    ...defaultCSV,
    metadata: {},
  } as IClusterServiceVersion;
  const wrapper = mountWrapper(
    getStore({ operators: { csv } } as Partial<IStoreState>),
    <OperatorInstanceForm {...defaultProps} />,
  );
  expect(wrapper.find(OperatorInstanceFormBody).props()).toMatchObject({
    defaultValues: "",
  });
});

it("renders an error if the CRD is not populated", () => {
  const wrapper = mountWrapper(defaultStore, <OperatorInstanceForm {...defaultProps} />);
  expect(wrapper.find(Alert)).toIncludeText("not found in the definition");
});

it("should submit the form", () => {
  const createResource = jest.fn();
  actions.operators.createResource = createResource;
  const wrapper = mountWrapper(
    getStore({ operators: { csv: defaultCSV } } as Partial<IStoreState>),
    <OperatorInstanceForm {...defaultProps} />,
  );

  act(() => {
    (wrapper.find(OperatorAdvancedDeploymentForm).prop("handleValuesChange") as any)(
      "apiVersion: v1\nmetadata:\n  name: foo",
    );
  });
  wrapper.update();

  const form = wrapper.find("form");
  form.simulate("submit", { preventDefault: jest.fn() });

  const resource = {
    apiVersion: "v1",
    metadata: {
      name: "foo",
    },
  };
  expect(createResource).toHaveBeenCalledWith(
    defaultProps.cluster,
    defaultProps.namespace,
    resource.apiVersion,
    defaultCRD.name,
    resource,
  );
});
