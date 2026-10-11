import {
  CheckBoxGroup as CheckBoxGroupControl,
  CheckBoxItem as CheckBoxItemControl,
  RadioGroup as RadioGroupControl,
  RadioItem as RadioItemControl,
} from "@openuidev/react-ui";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { useIsStreaming, useStateField } from "@openuidev/react-lang";
import type { ComponentRenderProps } from "@openuidev/react-lang";
import { useEffect, useMemo } from "react";

type RadioProps = {
  name: string;
  value?: string;
  defaultValue?: string;
  items?: Array<{ props: { value: string; label: string; description?: string } }>;
};

type CheckBoxProps = {
  name: string;
  value?: Record<string, boolean>;
  items?: Array<{
    props: { name: string; label: string; description?: string; defaultChecked?: boolean };
  }>;
};

function CheckBoxGroupWithPersistedDefaults({ props: rawProps }: ComponentRenderProps) {
  const props = rawProps as CheckBoxProps;
  const isStreaming = useIsStreaming();
  const field = useStateField(props.name, props.value);
  const defaults = useMemo(
    () => Object.fromEntries(
      (props.items ?? []).map((item) => [item.props.name, item.props.defaultChecked ?? false]),
    ),
    [props.items],
  );
  const value = field.value ?? defaults;

  useEffect(() => {
    if (!isStreaming && field.value === undefined && (props.items ?? []).length > 0) {
      field.setValue(defaults);
    }
  }, [defaults, field, isStreaming, props.items]);

  return (
    <CheckBoxGroupControl>
      {(props.items ?? []).map((item, index) => (
        <CheckBoxItemControl
          key={`${item.props.name}-${index}`}
          name={item.props.name}
          label={item.props.label}
          description={item.props.description ?? ""}
          checked={value[item.props.name] ?? false}
          disabled={isStreaming}
          onChange={(checked) => field.setValue({ ...value, [item.props.name]: checked })}
        />
      ))}
    </CheckBoxGroupControl>
  );
}

function RadioGroupWithPersistedDefault({ props: rawProps }: ComponentRenderProps) {
  const props = rawProps as RadioProps;
  const isStreaming = useIsStreaming();
  const field = useStateField(props.name, props.value);
  const value = field.value ?? props.defaultValue ?? "";

  useEffect(() => {
    if (!isStreaming && field.value === undefined && props.defaultValue !== undefined) {
      field.setValue(props.defaultValue);
    }
  }, [field, isStreaming, props.defaultValue]);

  return (
    <RadioGroupControl
      name={field.name}
      value={value}
      onValueChange={(nextValue) => field.setValue(nextValue)}
      disabled={isStreaming}
    >
      {(props.items ?? []).map((item, index) => (
        <RadioItemControl
          key={`${item.props.value}-${index}`}
          value={item.props.value}
          label={item.props.label}
          description={item.props.description ?? ""}
        />
      ))}
    </RadioGroupControl>
  );
}

export const appOpenuiLibrary = {
  ...openuiLibrary,
  components: {
    ...openuiLibrary.components,
    RadioGroup: {
      ...openuiLibrary.components.RadioGroup,
      component: RadioGroupWithPersistedDefault,
    },
    CheckBoxGroup: {
      ...openuiLibrary.components.CheckBoxGroup,
      component: CheckBoxGroupWithPersistedDefaults,
    },
  },
};
