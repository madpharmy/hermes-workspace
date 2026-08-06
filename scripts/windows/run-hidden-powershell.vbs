Option Explicit

If WScript.Arguments.Count < 1 Then
  WScript.Quit 87
End If

Dim commandLine
Dim index
Dim shell

commandLine = QuoteArgument(WScript.Arguments.Item(0))
For index = 1 To WScript.Arguments.Count - 1
  commandLine = commandLine & " " & QuoteArgument(WScript.Arguments.Item(index))
Next

Set shell = CreateObject("WScript.Shell")
WScript.Quit shell.Run(commandLine, 0, True)

Function QuoteArgument(value)
  Dim text
  text = CStr(value)
  If InStr(text, Chr(34)) > 0 Then
    Err.Raise 5, "run-hidden-powershell.vbs", "Arguments containing double quotes are not supported."
  End If
  QuoteArgument = Chr(34) & text & Chr(34)
End Function
