import { RadioGroup as RadioGroupControl, RadioItem as RadioItemControl } from "@openuidev/react-ui";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { useIsStreaming, useStateField } from "@openuidev/react-lang";
import type { ComponentRenderProps } from "@openuidev/react-lang";
import { useEffect } from "react";

type RadioProps = {
  name: string;
  value?: string;
  defaultValue?: string;
  items?: Array<{ props: { value: string; label: string; description?: string } }>;
};

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
  },
};
